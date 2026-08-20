import { getSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <h1>Settings</h1>
      <p className="admin-form__hint">
        Keys entered here override the .env file. Leave a field blank to keep its current value.
      </p>
      <SettingsForm
        initial={{
          stripeSecretKeySet: Boolean(settings.stripeSecretKey),
          stripeWebhookSecretSet: Boolean(settings.stripeWebhookSecret),
          resendApiKeySet: Boolean(settings.resendApiKey),
          emailFrom: settings.emailFrom ?? "",
          operationsEmail: settings.operationsEmail ?? "",
        }}
      />
    </>
  );
}
