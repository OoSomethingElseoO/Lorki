"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type SettingsFormProps = {
  initial: {
    stripeSecretKeySet: boolean;
    stripeWebhookSecretSet: boolean;
    resendApiKeySet: boolean;
    emailFrom: string;
    operationsEmail: string;
  };
};

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {};

    for (const key of ["stripeSecretKey", "stripeWebhookSecret", "resendApiKey", "emailFrom", "operationsEmail"]) {
      const value = form.get(key);
      if (typeof value === "string" && value.trim().length > 0) {
        body[key] = value.trim();
      }
    }

    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to save settings");
      return;
    }

    setSuccess(true);
    event.currentTarget.reset();
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} style={{ maxWidth: "36rem" }}>
      <h2 style={{ marginTop: 0 }}>Stripe</h2>
      <label htmlFor="stripeSecretKey">Secret key</label>
      <input
        id="stripeSecretKey"
        name="stripeSecretKey"
        type="password"
        placeholder={initial.stripeSecretKeySet ? "•••••••••••••••• (set — leave blank to keep)" : "sk_test_..."}
      />

      <label htmlFor="stripeWebhookSecret">Webhook signing secret</label>
      <input
        id="stripeWebhookSecret"
        name="stripeWebhookSecret"
        type="password"
        placeholder={initial.stripeWebhookSecretSet ? "•••••••••••••••• (set — leave blank to keep)" : "whsec_..."}
      />

      <h2>Email (Resend)</h2>
      <label htmlFor="resendApiKey">API key</label>
      <input
        id="resendApiKey"
        name="resendApiKey"
        type="password"
        placeholder={initial.resendApiKeySet ? "•••••••••••••••• (set — leave blank to keep)" : "re_..."}
      />

      <label htmlFor="emailFrom">From address</label>
      <input id="emailFrom" name="emailFrom" defaultValue={initial.emailFrom} placeholder="Lorkulup <onboarding@resend.dev>" />

      <label htmlFor="operationsEmail">Operations alert email</label>
      <input
        id="operationsEmail"
        name="operationsEmail"
        type="email"
        defaultValue={initial.operationsEmail}
        placeholder="you@example.com"
      />

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">Saved.</p> : null}
      <button type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
