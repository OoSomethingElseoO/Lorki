"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  "emailFrom",
  "operationsEmail",
];
const BRANDING_FIELDS = [
  "siteName",
  "heroTagline",
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
    flutterwaveSecretKeySet: boolean;
    flutterwaveWebhookSecretSet: boolean;
    resendApiKeySet: boolean;
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPasswordSet: boolean;
    emailFrom: string;
    operationsEmail: string;
    siteName: string;
    heroTagline: string;
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

  // One <form> spans all four tabs — Save at the bottom saves whatever was
  // changed on any of them, same as before this was split into tabs.
  // TabsContent keeps inactive panels mounted (hidden via the `hidden`
  // attribute, not unmounted) specifically so this keeps working: every
  // field stays part of the same FormData regardless of which tab is
  // currently visible.
  //
  // noValidate: the Hero image field (ImageUploadField, in the Branding
  // tab) is marked `required`, but the browser's native constraint
  // validation doesn't exempt a field just because its tab is currently
  // `hidden` — it still tries to block submission and focus the invalid
  // field, fails (a hidden element isn't focusable), and silently swallows
  // the whole submit with no user-visible feedback. Concretely: sit on the
  // Stripe/Flutterwave/Email tab with Hero image blank on Branding and
  // clicking Save does nothing. The server already treats a blank Hero
  // image as valid (falls back to a default — see the hint text right
  // next to that field), so nothing is actually lost by handling
  // validation ourselves instead of relying on the browser's.
  return (
    <form onSubmit={handleSubmit} noValidate>
      <Tabs defaultValue="branding">
        <TabsList aria-label="Settings sections">
          <TabsTrigger value="branding">Branding</TabsTrigger>
          <TabsTrigger value="stripe">Stripe</TabsTrigger>
          <TabsTrigger value="flutterwave">Flutterwave</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card variant="admin">
            <CardHeader>
              <CardTitle>Branding</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded">
              <label htmlFor="siteName">Site name</label>
              <input id="siteName" name="siteName" defaultValue={initial.siteName} placeholder="Aurelia Originals" />

              <label htmlFor="heroTagline">Hero tagline</label>
              <input
                id="heroTagline"
                name="heroTagline"
                defaultValue={initial.heroTagline}
                placeholder="Original artwork, collected with care."
              />

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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stripe">
          <Card variant="admin">
            <CardHeader>
              <CardTitle>Stripe</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded">
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flutterwave">
          <Card variant="admin">
            <CardHeader>
              <CardTitle>Flutterwave</CardTitle>
              <CardDescription>Mobile money / bank payouts, 30+ countries</CardDescription>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded">
              <p className="admin-form__hint">
                For artists banking somewhere Stripe doesn't support (e.g. Kenya, Ethiopia, South Africa) — sends
                their payout straight to mobile money or a bank account, per what each artist sets in their own
                profile. Leave blank until you've set up a Flutterwave account.
              </p>
              <label htmlFor="flutterwaveSecretKey">Secret key</label>
              <input
                id="flutterwaveSecretKey"
                name="flutterwaveSecretKey"
                type="password"
                placeholder={initial.flutterwaveSecretKeySet ? "•••••••••••••••• (set — leave blank to keep)" : "FLWSECK_..."}
              />

              <label htmlFor="flutterwaveWebhookSecret">Webhook secret hash</label>
              <input
                id="flutterwaveWebhookSecret"
                name="flutterwaveWebhookSecret"
                type="password"
                placeholder={
                  initial.flutterwaveWebhookSecretSet
                    ? "•••••••••••••••• (set — leave blank to keep)"
                    : "matches the hash configured in Flutterwave's dashboard"
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card variant="admin">
            <CardHeader>
              <CardTitle>Email (Resend)</CardTitle>
              <CardDescription>Primary — tried first when configured.</CardDescription>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded">
              <label htmlFor="resendApiKey">API key</label>
              <input
                id="resendApiKey"
                name="resendApiKey"
                type="password"
                placeholder={initial.resendApiKeySet ? "•••••••••••••••• (set — leave blank to keep)" : "re_..."}
              />

              <label htmlFor="emailFrom">From address</label>
              <input
                id="emailFrom"
                name="emailFrom"
                defaultValue={initial.emailFrom}
                placeholder="Lorkulup <onboarding@resend.dev>"
              />

              <label htmlFor="operationsEmail">Operations alert email</label>
              <input
                id="operationsEmail"
                name="operationsEmail"
                type="email"
                defaultValue={initial.operationsEmail}
                placeholder="you@example.com"
              />
            </CardContent>
          </Card>

          <Card variant="admin" className="mt-4">
            <CardHeader>
              <CardTitle>SMTP</CardTitle>
              <CardDescription>
                Fallback — used only when Resend isn&apos;t configured above, or a Resend send fails. Never sends the
                same email through both at once.
              </CardDescription>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded">
              <label htmlFor="smtpHost">Host</label>
              <input id="smtpHost" name="smtpHost" defaultValue={initial.smtpHost} placeholder="smtp.example.com" />

              <label htmlFor="smtpPort">Port</label>
              <input id="smtpPort" name="smtpPort" defaultValue={initial.smtpPort} placeholder="587" />

              <label htmlFor="smtpUser">Username</label>
              <input id="smtpUser" name="smtpUser" defaultValue={initial.smtpUser} placeholder="you@example.com" />

              <label htmlFor="smtpPassword">Password</label>
              <input
                id="smtpPassword"
                name="smtpPassword"
                type="password"
                placeholder={initial.smtpPasswordSet ? "•••••••••••••••• (set — leave blank to keep)" : "app password or SMTP secret"}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error ? <p className="admin-form__error">{error}</p> : null}
      {success ? <p className="admin-form__hint">Saved.</p> : null}
      <Button type="submit" variant="form" className="mt-3" disabled={submitting}>
        {submitting ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
