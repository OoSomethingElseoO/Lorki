import { prisma } from "@/lib/prisma";

const SETTINGS_ID = "singleton";

// Admin-entered values in the Settings table win; unset (null/empty) falls
// back to the env var, so a fresh deploy still works from .env before anyone
// has visited /admin/settings.
export async function getSettings() {
  return prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: { id: SETTINGS_ID },
  });
}

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

export async function getResendApiKey(): Promise<string | undefined> {
  const settings = await getSettings();
  return resolve(settings.resendApiKey, process.env.RESEND_API_KEY);
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
  heroTagline: "Original artwork, collected with care.",
  heroImageUrl: "/artwork/featured-original.png",
  heroAlt: "Original artwork.",
  missionStatement:
    "We believe original artwork should feel personal, considered, and accessible. This space is designed to connect collectors with artists through clear information, thoughtful presentation, and a calm browsing experience that respects every visitor.",
  contactName: "Kat Morgan",
  contactEmail: "kat@example.com",
  contactPhone: "(555) 019-2026",
};

export type Branding = typeof DEFAULT_BRANDING;

export async function getBranding(): Promise<Branding> {
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
}
