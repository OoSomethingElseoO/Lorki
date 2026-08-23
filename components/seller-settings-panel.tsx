"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SellerProfileForm } from "@/components/seller-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import type { SaveFormHandle } from "@/components/cause-profile-form";
import { Button, buttonVariants } from "@/components/ui/button";

type SellerSettingsPanelProps = {
  seller: {
    name: string;
    country: string;
    bio: string;
    imageUrl: string;
    payoutChannel: "MANUAL" | "FLUTTERWAVE" | "STRIPE_CONNECT" | "CRYPTO";
    payoutCountry: string | null;
    payoutCurrency: string | null;
    payoutMobileNetwork: string | null;
    payoutAccountNumber: string | null;
    payoutBankCode: string | null;
    stripeConnectOnboarded: boolean;
    cryptoNetwork: string | null;
    cryptoAddress: string | null;
  };
  recommendation: { channel: "FLUTTERWAVE" | "STRIPE_CONNECT"; note: string } | null;
};

// One "Save changes" button drives both forms below it — see
// cause-settings-panel.tsx (same pattern, seller side).
export function SellerSettingsPanel({ seller, recommendation }: SellerSettingsPanelProps) {
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
      <SellerProfileForm
        ref={profileRef}
        initial={{ name: seller.name, country: seller.country, bio: seller.bio, imageUrl: seller.imageUrl }}
      />

      <h2>Payouts</h2>
      <PayoutSettingsForm
        ref={payoutRef}
        initial={{
          payoutChannel: seller.payoutChannel,
          payoutCountry: seller.payoutCountry,
          payoutCurrency: seller.payoutCurrency,
          payoutMobileNetwork: seller.payoutMobileNetwork,
          payoutAccountNumber: seller.payoutAccountNumber,
          payoutBankCode: seller.payoutBankCode,
          stripeConnectOnboarded: seller.stripeConnectOnboarded,
          cryptoNetwork: seller.cryptoNetwork,
          cryptoAddress: seller.cryptoAddress,
        }}
        recommendation={recommendation}
        endpoint="/api/seller/payout-settings"
        connectOnboardEndpoint="/api/seller/connect/onboard"
      />

      <Button type="button" variant="form" className="mt-3" onClick={handleSaveAll} disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>

      <p style={{ marginTop: "2rem" }}>
        <Link href="/seller" className={buttonVariants({ variant: "outline" })}>
          Back to Dashboard
        </Link>
      </p>
    </>
  );
}
