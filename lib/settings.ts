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
