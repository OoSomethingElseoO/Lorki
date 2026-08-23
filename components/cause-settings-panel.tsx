"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CauseProfileForm, type SaveFormHandle } from "@/components/cause-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import { Button, buttonVariants } from "@/components/ui/button";

type CauseSettingsPanelProps = {
  cause: {
    name: string;
    region: string;
    mission: string;
    website: string;
    contactEmail: string;
    registrationNumber: string | null;
    registrationDocumentUrl: string | null;
    verifiedAt: Date | null;
    payoutChannel: "MANUAL" | "FLUTTERWAVE" | "STRIPE_CONNECT" | "CRYPTO";
    payoutCountry: string | null;
    payoutCurrency: string | null;
    payoutMobileNetwork: string | null;
    payoutAccountNumber: string | null;
    payoutBankCode: string | null;
    stripeConnectOnboarded: boolean;
    cryptoNetwork: string | null;
    cryptoAddress: string | null;
    payoutAccountHolderName: string | null;
  };
  recommendation: { channel: "FLUTTERWAVE" | "STRIPE_CONNECT"; note: string } | null;
};

// One "Save changes" button drives both forms below it instead of each
// having its own — see cause-profile-form.tsx for why they're built as
// imperative-submit forms rather than each managing its own fetch+button.
export function CauseSettingsPanel({ cause, recommendation }: CauseSettingsPanelProps) {
  const router = useRouter();
  const profileRef = useRef<SaveFormHandle>(null);
  const payoutRef = useRef<SaveFormHandle>(null);
  const [saving, setSaving] = useState(false);

  async function handleSaveAll() {
    setSaving(true);
    await Promise.all([profileRef.current?.submit(), payoutRef.current?.submit()]);
    setSaving(false);
    router.refresh();
  }

  return (
    <>
      <div className="admin-form">
        <CauseProfileForm
          ref={profileRef}
          initial={{
            name: cause.name,
            region: cause.region,
            mission: cause.mission,
            website: cause.website,
            contactEmail: cause.contactEmail,
            registrationNumber: cause.registrationNumber,
            registrationDocumentUrl: cause.registrationDocumentUrl,
            verifiedAt: cause.verifiedAt,
          }}
        />

        <h2 style={{ marginTop: "1rem" }}>Payouts</h2>
        <PayoutSettingsForm
          ref={payoutRef}
          initial={{
            payoutChannel: cause.payoutChannel,
            payoutCountry: cause.payoutCountry,
            payoutCurrency: cause.payoutCurrency,
            payoutMobileNetwork: cause.payoutMobileNetwork,
            payoutAccountNumber: cause.payoutAccountNumber,
            payoutBankCode: cause.payoutBankCode,
            stripeConnectOnboarded: cause.stripeConnectOnboarded,
            cryptoNetwork: cause.cryptoNetwork,
            cryptoAddress: cause.cryptoAddress,
            payoutAccountHolderName: cause.payoutAccountHolderName,
          }}
          recommendation={recommendation}
          endpoint="/api/cause/payout-settings"
          connectOnboardEndpoint="/api/cause/connect/onboard"
          requireAccountHolderName
        />

        <Button type="button" variant="form" className="mt-3" onClick={handleSaveAll} disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/account" className={buttonVariants({ variant: "outline" })}>
          Back to My Account
        </Link>
      </p>
    </>
  );
}
