import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

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

export async function GET() {
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
      heroImageUrl: settings.heroImageUrl ?? "",
      heroAlt: settings.heroAlt ?? "",
      missionStatement: settings.missionStatement ?? "",
      contactName: settings.contactName ?? "",
      contactEmail: settings.contactEmail ?? "",
      contactPhone: settings.contactPhone ?? "",
    },
  });
}

type UpdateBody = Partial<Record<(typeof SECRET_FIELDS)[number] | (typeof BRANDING_FIELDS)[number] | "emailFrom" | "operationsEmail", string>>;

export async function PATCH(request: Request) {
  const body = (await request.json()) as UpdateBody;
  const data: Record<string, string> = {};

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

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  return NextResponse.json({ ok: true });
}
