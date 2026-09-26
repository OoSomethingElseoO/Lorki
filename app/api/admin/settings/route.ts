import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings, normalizeEmailTemplates, normalizeHeroHeadlineWords } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { encryptSettingsSecrets } from "@/lib/secret-settings";
import { readJsonObject } from "@/lib/request-json";
import { enforceHighRiskMfa } from "@/lib/mfa-policy";

const HEADLINE_POOL_KEYS = ["first", "second", "third"] as const;
const MAX_HEADLINE_WORDS = 24;
const MAX_HEADLINE_WORD_LENGTH = 48;

const SECRET_FIELDS = [
  "stripeSecretKey",
  "stripeWebhookSecret",
  "flutterwaveSecretKey",
  "flutterwaveWebhookSecret",
  "resendApiKey",
  "smtpHost",
  "smtpPort",
  "smtpUser",
  "smtpPassword",
] as const;
const BRANDING_FIELDS = [
  "siteName",
  "heroTagline",
  "heroImageUrl",
  "heroAlt",
  "missionStatement",
  "contactName",
  "contactEmail",
  "contactPhone",
] as const;

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const settings = await getSettings();

  return NextResponse.json({
    settings: {
      stripeSecretKeySet: Boolean(settings.stripeSecretKey),
      stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret),
      flutterwaveSecretKeySet: Boolean(settings.flutterwaveSecretKey),
      flutterwaveWebhookSecretSet: Boolean(settings.flutterwaveWebhookSecret),
      resendApiKeySet: Boolean(settings.resendApiKey),
      // Host/port/user are shown as plain text (an admin needs to actually
      // see what's configured, unlike a secret) — only the password stays
      // masked-only, same treatment as the other provider secrets above.
      smtpHost: settings.smtpHost ?? "",
      smtpPort: settings.smtpPort ?? "",
      smtpUser: settings.smtpUser ?? "",
      smtpPasswordSet: Boolean(settings.smtpPassword),
      emailFrom: settings.emailFrom ?? "",
      operationsEmail: settings.operationsEmail ?? "",
      siteName: settings.siteName ?? "",
      heroTagline: settings.heroTagline ?? "",
      heroHeadlineWords: normalizeHeroHeadlineWords(settings.heroHeadlineWords),
      heroImageUrl: settings.heroImageUrl ?? "",
      heroAlt: settings.heroAlt ?? "",
      missionStatement: settings.missionStatement ?? "",
      contactName: settings.contactName ?? "",
      contactEmail: settings.contactEmail ?? "",
      contactPhone: settings.contactPhone ?? "",
      emailTemplates: normalizeEmailTemplates(settings.emailTemplates),
      requireMfaForAdmins: Boolean(settings.requireMfaForAdmins),
      requireMfaForHighRisk: Boolean(settings.requireMfaForHighRisk),
      allowMfaEmailOtp: Boolean(settings.allowMfaEmailOtp),
    },
  });
}

type UpdateBody = Partial<Record<(typeof SECRET_FIELDS)[number] | (typeof BRANDING_FIELDS)[number] | "emailFrom" | "operationsEmail", string>> & {
  heroHeadlineWords?: unknown;
  emailTemplates?: unknown;
  requireMfaForAdmins?: boolean;
  requireMfaForHighRisk?: boolean;
  allowMfaEmailOtp?: boolean;
};

function validateHeroHeadlineWords(value: unknown): Record<(typeof HEADLINE_POOL_KEYS)[number], string[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("heroHeadlineWords must be an object with first, second, and third arrays");
  }
  const input = value as Record<string, unknown>;
  const output = {} as Record<(typeof HEADLINE_POOL_KEYS)[number], string[]>;
  for (const key of HEADLINE_POOL_KEYS) {
    const pool = input[key];
    if (!Array.isArray(pool) || pool.length < 1 || pool.length > MAX_HEADLINE_WORDS) {
      throw new Error(`${key} must contain 1-${MAX_HEADLINE_WORDS} words`);
    }
    const words = pool.map((word) => {
      if (typeof word !== "string") throw new Error(`${key} contains a non-text word`);
      // The storefront appends the sentence punctuation as part of the
      // morphing value; keep admin pools noun-only to avoid duplicate marks.
      const normalized = word.trim().replace(/[.!?]+$/g, "").trim();
      if (!normalized || normalized.length > MAX_HEADLINE_WORD_LENGTH) {
        throw new Error(`${key} words must be 1-${MAX_HEADLINE_WORD_LENGTH} characters`);
      }
      return normalized;
    });
    output[key] = [...new Set(words)];
  }
  return output;
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const mfaError = await enforceHighRiskMfa(request);
  if (mfaError) return mfaError;

  const body = await readJsonObject(request) as UpdateBody | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);
  const data: Record<string, unknown> = {};

  if (body.heroHeadlineWords !== undefined) {
    try {
      data.heroHeadlineWords = validateHeroHeadlineWords(body.heroHeadlineWords);
    } catch (error) {
      return apiContractError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid headline word pools", 400);
    }
  }
  if (body.emailTemplates !== undefined) {
    const normalized = normalizeEmailTemplates(body.emailTemplates);
    data.emailTemplates = normalized;
  }
  for (const key of ["requireMfaForAdmins", "requireMfaForHighRisk", "allowMfaEmailOtp"] as const) {
    if (typeof body[key] === "boolean") data[key] = body[key];
  }
  if (body.requireMfaForAdmins === true) {
    const [adminCount, enrolledAdminCount] = await Promise.all([
      prisma.user.count({ where: { isAdmin: true, accountStatus: "ACTIVE" } }),
      prisma.user.count({ where: { isAdmin: true, accountStatus: "ACTIVE", mfaEnabled: true } }),
    ]);
    if (adminCount !== enrolledAdminCount) {
      return apiContractError("CONFLICT", "Every active administrator must enroll in MFA before the administrator requirement can be enabled", 409, { adminCount, enrolledAdminCount });
    }
  }

  // Secrets (and smtpHost/Port/User, which aren't secret but share the same
  // "blank means leave alone" treatment): a blank submit is never an
  // intentional clear.
  for (const key of [...SECRET_FIELDS, "emailFrom", "operationsEmail"] as const) {
    const value = body[key];
    if (typeof value === "string" && value.trim().length > 0) {
      data[key] = value.trim();
    }
  }

  // Branding: shown and edited as plain text, so an explicit blank is a
  // real choice — clearing it falls back to the built-in default, not
  // "don't touch this field."
  for (const key of BRANDING_FIELDS) {
    const value = body[key];
    if (typeof value === "string") {
      data[key] = value.trim();
    }
  }

  const encryptedData = encryptSettingsSecrets(data, SECRET_FIELDS);
  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: encryptedData,
    create: { id: "singleton", ...encryptedData },
  });
  await recordAudit({ action: "ADMIN_SETTINGS_UPDATED", affectedEntityType: "Settings", affectedEntityId: "singleton", reason: "Operations administrator updated application settings", changedBy: user!.email, metadata: { fields: Object.keys(data).filter((key) => !SECRET_FIELDS.includes(key as (typeof SECRET_FIELDS)[number])), encryptedSecretFields: Object.keys(data).filter((key) => SECRET_FIELDS.includes(key as (typeof SECRET_FIELDS)[number])) } });

  return NextResponse.json({ ok: true });
}
