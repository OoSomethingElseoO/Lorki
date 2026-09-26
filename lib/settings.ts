import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { decryptSetting } from "@/lib/secret-settings";

const SETTINGS_ID = "singleton";

export const DEFAULT_EMAIL_TEMPLATES = {
  welcome: { subject: "Welcome to {{siteName}}", body: "Your account is ready. Browse the collection at {{productsUrl}}." },
  orderConfirmation: { subject: "Your order: {{artworkTitle}}", body: "Thanks for your order. {{artworkTitle}} — {{amount}}. We will email you when it ships." },
  inquiryConfirmation: { subject: "We received your inquiry: {{artworkTitle}}", body: "Thanks for your interest in {{artworkTitle}}. Our team will contact you about payment and shipping." },
  shipping: { subject: "Your artwork has shipped: {{artworkTitle}}", body: "{{artworkTitle}} is on its way. Tracking: {{tracking}}." },
  refund: { subject: "Your refund: {{artworkTitle}}", body: "Your refund for {{artworkTitle}} ({{amount}}) has been recorded." },
  deletionRequested: { subject: "Account closure request received", body: "We received your request to close your {{siteName}} account. Access is suspended while it is reviewed." },
  deletionDecision: { subject: "Update on your account request", body: "Your account request was {{decision}}. {{note}}" },
  offerSubmitted: { subject: "Offer received for {{artworkTitle}}", body: "We received your offer of {{amount}} for {{artworkTitle}}." },
  offerDecision: { subject: "Offer update for {{artworkTitle}}", body: "Your offer for {{artworkTitle}} was {{decision}}." },
  payout: { subject: "Payout update", body: "A payout of {{amount}} for {{artworkTitle}} was marked {{status}}." },
  workVisibility: { subject: "Artwork visibility update", body: "{{count}} unsold artwork item(s) were {{action}} by the gallery team." },
  mfaReminder: { subject: "Protect your {{siteName}} account", body: "Two-step verification is available for your account. Open your security settings to enable an authenticator app." },
} as const;

export type EmailTemplates = { -readonly [K in keyof typeof DEFAULT_EMAIL_TEMPLATES]: { subject: string; body: string } };

export function normalizeEmailTemplates(value: unknown): EmailTemplates {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const output = {} as EmailTemplates;
  for (const [key, fallback] of Object.entries(DEFAULT_EMAIL_TEMPLATES) as [keyof EmailTemplates, EmailTemplates[keyof EmailTemplates]][]) {
    const candidate = input[key];
    const row = candidate && typeof candidate === "object" ? candidate as Record<string, unknown> : {};
    output[key] = {
      subject: typeof row.subject === "string" && row.subject.trim() ? row.subject.trim().slice(0, 200) : fallback.subject,
      body: typeof row.body === "string" && row.body.trim() ? row.body.trim().slice(0, 5000) : fallback.body,
    };
  }
  return output;
}

// Admin-entered values in the Settings table win; unset (null/empty) falls
// back to the env var, so a fresh deploy still works from .env before anyone
// has visited /admin/settings.
//
// Wrapped in React's cache() — every page renders SiteHeader, Footer, and
// (via the root layout's generateMetadata) this same lookup independently,
// so one request used to fire this 3+ times with no dedup. cache() memoizes
// by argument within a single request's render pass, collapsing that back
// to one real call — a request-scoped memo, not a cross-request one, so an
// admin's saved change is still visible on the very next request.
export const getSettings = cache(async function getSettings() {
  // The plain SELECT covers the overwhelmingly common case (the row
  // already exists) without writing anything — the previous unconditional
  // upsert() ran a real UPDATE (touching updatedAt) on every single page
  // view across the whole site, load-bearing traffic for a table that only
  // actually needs writing when an admin saves a change in /admin/settings.
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) {
    return {
      ...existing,
      stripeSecretKey: decryptSetting(existing.stripeSecretKey),
      stripeWebhookSecret: decryptSetting(existing.stripeWebhookSecret),
      flutterwaveSecretKey: decryptSetting(existing.flutterwaveSecretKey),
      flutterwaveWebhookSecret: decryptSetting(existing.flutterwaveWebhookSecret),
      resendApiKey: decryptSetting(existing.resendApiKey),
      smtpHost: decryptSetting(existing.smtpHost),
      smtpPort: decryptSetting(existing.smtpPort),
      smtpUser: decryptSetting(existing.smtpUser),
      smtpPassword: decryptSetting(existing.smtpPassword),
      emailTemplates: normalizeEmailTemplates(existing.emailTemplates),
    };
  }
  // Only reached once, ever, on a fresh deploy before the singleton row exists.
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
});

function resolve(dbValue: string | null | undefined, envValue: string | undefined): string | undefined {
  return dbValue && dbValue.length > 0 ? dbValue : envValue;
}

export async function getStripeSecretKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.stripeSecretKey, process.env.STRIPE_SECRET_KEY);
}

export async function getStripeWebhookSecret(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.stripeWebhookSecret, process.env.STRIPE_WEBHOOK_SECRET);
}

export async function getFlutterwaveSecretKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.flutterwaveSecretKey, process.env.FLUTTERWAVE_SECRET_KEY);
}

export async function getFlutterwaveWebhookSecret(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.flutterwaveWebhookSecret, process.env.FLUTTERWAVE_WEBHOOK_SECRET);
}

export async function getResendApiKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.resendApiKey, process.env.RESEND_API_KEY);
}

export type SmtpConfig = { host: string; port: number; user?: string; password?: string };

// Undefined means "not configured" — sendEmail (lib/email.ts) treats that
// as SMTP simply not being an available fallback, not an error.
export async function getSmtpConfig(): Promise<SmtpConfig | undefined> {
  const settings = await getSettings();
  const host = resolve(settings.smtpHost, process.env.SMTP_HOST);
  if (!host) {
    return undefined;
  }
  const port = Number(resolve(settings.smtpPort, process.env.SMTP_PORT) ?? "587");
  return {
    host,
    port: Number.isFinite(port) ? port : 587,
    user: resolve(settings.smtpUser, process.env.SMTP_USER),
    password: resolve(settings.smtpPassword, process.env.SMTP_PASSWORD),
  };
}

export async function getEmailFrom(): Promise<string> {
  const settings = await getSettings();
  return resolve(settings.emailFrom, process.env.EMAIL_FROM) ?? "Lorkulup <onboarding@resend.dev>";
}

export async function getOperationsEmail(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.operationsEmail, process.env.OPERATIONS_EMAIL);
}

export async function getMfaPolicy() {
  const settings = await getSettings();
  return {
    requireMfaForAdmins: Boolean(settings.requireMfaForAdmins),
    requireMfaForHighRisk: Boolean(settings.requireMfaForHighRisk),
    allowMfaEmailOtp: Boolean(settings.allowMfaEmailOtp),
  };
}

// Built-in fallbacks so the site still renders sensibly before an admin has
// ever visited /admin/settings — not meant to be the permanent brand.
const DEFAULT_BRANDING = {
  siteName: "Lorki Originals",
  heroTagline: "Sell art. Own masterpieces. Protect wildlife.",
  heroHeadlineWords: {
    first: ["art", "masterpieces", "originals"],
    second: ["masterpieces", "originals", "art"],
    third: ["wildlife", "lions", "elephants", "habitats"],
  },
  heroImageUrl: "/artwork/featured-original.png",
  heroAlt: "Original artwork.",
  missionStatement:
    "We believe original artwork should feel personal, considered, and accessible. This space is designed to connect collectors with artists through clear information, thoughtful presentation, and a calm browsing experience that respects every visitor.",
  contactName: "Kat Morgan",
  contactEmail: "kat@example.com",
  contactPhone: "(555) 019-2026",
};

export type Branding = typeof DEFAULT_BRANDING;

export type HeroHeadlineWords = Branding["heroHeadlineWords"];

/**
 * Settings are user-editable JSON, so never pass an unvalidated value to the
 * public storefront. This mirrors the API validation and also protects the
 * site if a row was edited directly or an older database contains malformed
 * JSON.
 */
export function normalizeHeroHeadlineWords(value: unknown): HeroHeadlineWords {
  const fallback = DEFAULT_BRANDING.heroHeadlineWords;
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const candidate = value as Record<string, unknown>;
  const normalize = (key: keyof HeroHeadlineWords) => {
    const pool = candidate[key];
    if (!Array.isArray(pool)) return fallback[key];
    const words = pool
      .filter((word): word is string => typeof word === "string")
      .map((word) => word.trim().replace(/[.!?]+$/g, "").trim())
      .filter(Boolean)
      .slice(0, 24);
    return words.length > 0 ? words : fallback[key];
  };
  return { first: normalize("first"), second: normalize("second"), third: normalize("third") };
}

// Called from the root layout's generateMetadata and from SiteHeader, both
// of which render on essentially every page — including fully static ones,
// where Next.js still resolves metadata/components at build time. A
// database hiccup here (or no build-time DB access at all, which is normal
// on most hosts) must degrade to the hardcoded defaults, never crash
// rendering — this is purely cosmetic content, unlike getStripeSecretKey()
// etc., which must keep failing loudly since a silent fallback there could
// mask a real payment-processing outage.
export async function getBranding(): Promise<Branding> {
  try {
    const settings = await getSettings();
    return {
      siteName: settings.siteName?.trim() || DEFAULT_BRANDING.siteName,
      heroTagline: settings.heroTagline?.trim() || DEFAULT_BRANDING.heroTagline,
      heroHeadlineWords: normalizeHeroHeadlineWords(settings.heroHeadlineWords),
      heroImageUrl: settings.heroImageUrl?.trim() || DEFAULT_BRANDING.heroImageUrl,
      heroAlt: settings.heroAlt?.trim() || DEFAULT_BRANDING.heroAlt,
      missionStatement: settings.missionStatement?.trim() || DEFAULT_BRANDING.missionStatement,
      contactName: settings.contactName?.trim() || DEFAULT_BRANDING.contactName,
      contactEmail: settings.contactEmail?.trim() || DEFAULT_BRANDING.contactEmail,
      contactPhone: settings.contactPhone?.trim() || DEFAULT_BRANDING.contactPhone,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
}
