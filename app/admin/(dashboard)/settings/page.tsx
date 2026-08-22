import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <h1>Settings</h1>
      <p className="admin-form__hint">
        Branding fields blank out to sensible defaults. Stripe/email keys entered here override the .env
        file — leave those blank to keep the current value.
      </p>
      <SettingsForm
        initial={{
          stripeSecretKeySet: Boolean(settings.stripeSecretKey),
          stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret),
          flutterwaveSecretKeySet: Boolean(settings.flutterwaveSecretKey),
          flutterwaveWebhookSecretSet: Boolean(settings.flutterwaveWebhookSecret),
          resendApiKeySet: Boolean(settings.resendApiKey),
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
        }}
      />
    </>
  );
}
