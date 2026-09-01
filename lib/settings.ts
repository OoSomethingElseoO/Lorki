import { cache } from "react";
import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

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
    return existing;
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

// Built-in fallbacks so the site still renders sensibly before an admin has
// ever visited /admin/settings — not meant to be the permanent brand.
const DEFAULT_BRANDING = {
  siteName: "Aurelia Originals",
  heroTagline: "Own art. Protect wildlife.",
  heroImageUrl: "/artwork/featured-original.png",
  heroAlt: "Original artwork.",
  missionStatement:
    "We believe original artwork should feel personal, considered, and accessible. This space is designed to connect collectors with artists through clear information, thoughtful presentation, and a calm browsing experience that respects every visitor.",
  contactName: "Kat Morgan",
  contactEmail: "kat@example.com",
  contactPhone: "(555) 019-2026",
};

export type Branding = typeof DEFAULT_BRANDING;

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
