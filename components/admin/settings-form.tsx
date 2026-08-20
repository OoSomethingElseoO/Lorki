"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";

const SECRET_FIELDS = ["stripeSecretKey", "stripeWebhookSecret", "resendApiKey", "emailFrom", "operationsEmail"];
const BRANDING_FIELDS = [
  "siteName",
  "heroImageUrl",
  "heroAlt",
  "missionStatement",
  "contactName",
  "contactEmail",
  "contactPhone",
];

type SettingsFormProps = {
  initial: {
    stripeSecretKeySet: boolean;
    stripeWebhookSecretSet: boolean;
    resendApiKeySet: boolean;
    emailFrom: string;
    operationsEmail: string;
    siteName: string;
    heroImageUrl: string;
    heroAlt: string;
    missionStatement: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
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

    // Secrets: only send if the admin actually typed something new — a
    // blank field means "leave the stored value alone."
    for (const key of SECRET_FIELDS) {
      const value = form.get(key);
      if (typeof value === "string" && value.trim().length > 0) {
        body[key] = value.trim();
      }
    }

    // Branding: always send, even blank — the admin can deliberately clear
    // a field to fall back to the built-in default.
    for (const key of BRANDING_FIELDS) {
      const value = form.get(key);
      body[key] = typeof value === "string" ? value : "";
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
    router.refresh();
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit} style={{ maxWidth: "36rem" }}>
      <h2 style={{ marginTop: 0 }}>Branding</h2>
      <label htmlFor="siteName">Site name</label>
      <input id="siteName" name="siteName" defaultValue={initial.siteName} placeholder="Aurelia Originals" />

      <ImageUploadField name="heroImageUrl" label="Hero image" defaultValue={initial.heroImageUrl} />
      <p className="admin-form__hint">
        Shown on the homepage. Leave blank to automatically show whatever original is currently for sale.
      </p>

      <label htmlFor="heroAlt">Hero image alt text</label>
      <input id="heroAlt" name="heroAlt" defaultValue={initial.heroAlt} placeholder="Original artwork." />

      <label htmlFor="missionStatement">Mission statement</label>
      <textarea id="missionStatement" name="missionStatement" rows={4} defaultValue={initial.missionStatement} />

      <label htmlFor="contactName">Contact name</label>
      <input id="contactName" name="contactName" defaultValue={initial.contactName} />

      <label htmlFor="contactEmail">Contact email</label>
      <input id="contactEmail" name="contactEmail" type="email" defaultValue={initial.contactEmail} />

      <label htmlFor="contactPhone">Contact phone</label>
      <input id="contactPhone" name="contactPhone" defaultValue={initial.contactPhone} />

      <h2>Stripe</h2>
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
