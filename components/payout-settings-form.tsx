"use client";

import { forwardRef, useImperativeHandle, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { SaveFormHandle } from "@/components/cause-profile-form";

type PayoutChannel = "MANUAL" | "FLUTTERWAVE" | "STRIPE_CONNECT" | "CRYPTO";

type PayoutSettingsFormProps = {
  initial: {
    payoutChannel: PayoutChannel;
    payoutCountry: string | null;
    payoutCurrency: string | null;
    payoutMobileNetwork: string | null;
    payoutAccountNumber: string | null;
    payoutBankCode: string | null;
    stripeConnectOnboarded: boolean;
    cryptoNetwork: string | null;
    cryptoAddress: string | null;
    payoutAccountHolderName?: string | null;
  };
  recommendation: { channel: "FLUTTERWAVE" | "STRIPE_CONNECT"; note: string } | null;
  // Lets this same form work for either an artist or a cause — each has
  // its own PATCH endpoint (identical validation, different Prisma model)
  // and its own Stripe Connect onboarding endpoint.
  endpoint: string;
  connectOnboardEndpoint: string;
  // Only a cause needs this: money should go to the organization's own
  // account, not an individual's personal M-Pesa number, so an admin
  // checks this name against the org's registered name at verification.
  // An individual artist has no separate "account holder" to check against
  // their own name, so the artist usage of this form omits the prop.
  requireAccountHolderName?: boolean;
};

const CHANNEL_LABELS: Record<PayoutChannel, string> = {
  MANUAL: "Manual",
  FLUTTERWAVE: "Mobile money or bank transfer (Flutterwave)",
  STRIPE_CONNECT: "Stripe",
  CRYPTO: "Crypto",
};

// Driven by the same combined "Save changes" button as the profile form
// next to it (see app/artist|cause/(dashboard)/profile/page.tsx) for every
// channel except Stripe — Stripe isn't a savable field, it's a redirect
// into Stripe's own onboarding, so "Connect with Stripe" stays its own
// explicit action regardless.
export const PayoutSettingsForm = forwardRef<SaveFormHandle, PayoutSettingsFormProps>(function PayoutSettingsForm(
  { initial, recommendation, endpoint, connectOnboardEndpoint, requireAccountHolderName },
  ref,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [channel, setChannel] = useState<PayoutChannel>(initial.payoutChannel);
  const [usingMobileMoney, setUsingMobileMoney] = useState(Boolean(initial.payoutMobileNetwork));
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [stripeConnecting, setStripeConnecting] = useState(false);

  async function doSubmit(): Promise<boolean> {
    // Nothing to save here for Stripe — its own state is set by the
    // redirect flow below, not by this form's fields.
    if (channel === "STRIPE_CONNECT") return true;
    if (!formRef.current) return false;

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(formRef.current);
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payoutChannel: channel,
        payoutCountry: form.get("payoutCountry"),
        payoutCurrency: form.get("payoutCurrency"),
        payoutMobileNetwork: usingMobileMoney ? form.get("payoutMobileNetwork") : "",
        payoutAccountNumber: form.get("payoutAccountNumber"),
        payoutBankCode: usingMobileMoney ? "" : form.get("payoutBankCode"),
        payoutAccountHolderName: form.get("payoutAccountHolderName"),
        cryptoNetwork: form.get("cryptoNetwork"),
        cryptoAddress: form.get("cryptoAddress"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to save payout settings");
      return false;
    }

    setSuccess("Payout settings saved.");
    return true;
  }

  useImperativeHandle(ref, () => ({ submit: doSubmit }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void doSubmit();
  }

  async function handleConnectStripe() {
    setStripeConnecting(true);
    setError(null);

    const response = await fetch(connectOnboardEndpoint, { method: "POST" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setStripeConnecting(false);
      setError(data.error ?? "Failed to start Stripe onboarding");
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div className="admin-form">
      {recommendation && recommendation.channel !== channel ? (
        <p className="admin-form__hint">
          Based on your profile's country, we'd recommend <strong>{CHANNEL_LABELS[recommendation.channel]}</strong>:{" "}
          {recommendation.note}
        </p>
      ) : null}

      <label htmlFor="payoutChannel">How you get paid</label>
      <select
        id="payoutChannel"
        value={channel}
        onChange={(event) => setChannel(event.target.value as PayoutChannel)}
        disabled={submitting}
      >
        <option value="MANUAL">Manual — we'll arrange payment directly</option>
        <option value="FLUTTERWAVE">Mobile money or bank transfer (Flutterwave)</option>
        <option value="STRIPE_CONNECT">Stripe (bank account in a Stripe-supported country)</option>
        <option value="CRYPTO">Crypto</option>
      </select>

      {channel === "STRIPE_CONNECT" ? (
        <>
          <p className="admin-form__hint">
            {initial.stripeConnectOnboarded
              ? "Stripe is connected — payouts go straight to your bank account."
              : "Not connected yet. You'll be taken to Stripe to securely add your bank details — we never see them."}
          </p>
          <Button type="button" variant="form" className="mt-3" onClick={handleConnectStripe} disabled={stripeConnecting}>
            {stripeConnecting ? "Redirecting…" : initial.stripeConnectOnboarded ? "Update Stripe details" : "Connect with Stripe"}
          </Button>
        </>
      ) : channel === "FLUTTERWAVE" ? (
        <form ref={formRef} onSubmit={handleSubmit}>
          <p className="admin-form__hint">
            Covers mobile money (M-Pesa, MTN, Airtel, and others) or a bank account, across 30+ countries —
            pick whichever applies to you.
          </p>
          <div className="admin-form__split-row">
            <div>
              <label htmlFor="payoutCountry">Country</label>
              <input id="payoutCountry" name="payoutCountry" defaultValue={initial.payoutCountry ?? ""} placeholder="e.g. KE, ET, ZA, NG" required disabled={submitting} />
            </div>
            <div>
              <label htmlFor="payoutCurrency">Currency</label>
              <input id="payoutCurrency" name="payoutCurrency" defaultValue={initial.payoutCurrency ?? ""} placeholder="e.g. KES, ETB, ZAR, NGN" required disabled={submitting} />
            </div>
          </div>

          {requireAccountHolderName ? (
            <>
              <label htmlFor="payoutAccountHolderName">Account holder name</label>
              <input
                id="payoutAccountHolderName"
                name="payoutAccountHolderName"
                defaultValue={initial.payoutAccountHolderName ?? ""}
                placeholder="Must match your organization's registered name"
                required
                disabled={submitting}
              />
            </>
          ) : null}

          <label>
            <input
              type="checkbox"
              checked={usingMobileMoney}
              onChange={(event) => setUsingMobileMoney(event.target.checked)}
              disabled={submitting}
            />{" "}
            Paid via mobile money (not a bank account)
          </label>

          {usingMobileMoney ? (
            <>
              <label htmlFor="payoutMobileNetwork">Mobile money network</label>
              <input
                id="payoutMobileNetwork"
                name="payoutMobileNetwork"
                defaultValue={initial.payoutMobileNetwork ?? ""}
                placeholder="e.g. Mpesa, MTN, Airtel"
                required
                disabled={submitting}
              />
              <label htmlFor="payoutAccountNumber">Phone number (with country code)</label>
              <input
                id="payoutAccountNumber"
                name="payoutAccountNumber"
                defaultValue={initial.payoutAccountNumber ?? ""}
                placeholder="e.g. 2547XXXXXXXX"
                required
                disabled={submitting}
              />
            </>
          ) : (
            <>
              <label htmlFor="payoutBankCode">Bank code</label>
              <input id="payoutBankCode" name="payoutBankCode" defaultValue={initial.payoutBankCode ?? ""} required disabled={submitting} />
              <label htmlFor="payoutAccountNumber">Account number</label>
              <input
                id="payoutAccountNumber"
                name="payoutAccountNumber"
                defaultValue={initial.payoutAccountNumber ?? ""}
                required
                disabled={submitting}
              />
            </>
          )}
        </form>
      ) : channel === "CRYPTO" ? (
        <form ref={formRef} onSubmit={handleSubmit}>
          <p className="admin-form__hint">
            No automated sending yet — we send this manually from our own wallet/exchange and mark it paid
            once it's sent, so payouts may take a little longer than other channels.
          </p>
          <label htmlFor="cryptoNetwork">Network / token</label>
          <input
            id="cryptoNetwork"
            name="cryptoNetwork"
            defaultValue={initial.cryptoNetwork ?? ""}
            placeholder="e.g. USDC on Base, USDC on Polygon"
            required
            disabled={submitting}
          />
          <label htmlFor="cryptoAddress">Wallet address</label>
          <input id="cryptoAddress" name="cryptoAddress" defaultValue={initial.cryptoAddress ?? ""} required disabled={submitting} />
        </form>
      ) : (
        <form ref={formRef} onSubmit={handleSubmit}>
          <p className="admin-form__hint">We'll pay you directly (bank transfer, cash, or as agreed) once a sale settles.</p>
        </form>
      )}

      {error ? <p className="admin-form__error">Payouts: {error}</p> : null}
      {success ? <p className="admin-form__hint">{success}</p> : null}
    </div>
  );
});
