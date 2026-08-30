"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { CauseProfileForm, type SaveFormHandle } from "@/components/cause-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

// Profile and Payouts each get their own tab and their own independent Save
// action — editing your org's profile must not resubmit (or even touch) your
// payout details, and vice versa. See docs/DASHBOARD_UX_AUDIT.md ("merge
// identity and payout fields" finding). CauseProfileForm and
// PayoutSettingsForm already render their own <form>/box and already expose
// an imperative submit() via SaveFormHandle — neither needed to change, only
// how this panel composes and drives them (two buttons instead of one).
//
// CardContent gets "admin-form admin-form--embedded" (not just the plain
// Card content class) so the existing `.admin-form .admin-form` CSS rule
// kicks in on the form nested inside it and drops that form's own box —
// otherwise CauseProfileForm's <form className="admin-form"> (and
// PayoutSettingsForm's outer <div className="admin-form">) would render a
// second bordered box nested inside the Card's box.
//
// It also gets "cause-tab-form": `.page-main .admin-form,
// .dashboard-main--brand .admin-form` (app/globals.css) centers a
// standalone .admin-form with `margin-left/right: auto` — fine when that
// form still has its own max-width (e.g. on /cause/onboarding), but once
// nested here its max-width is reset to none by `.admin-form .admin-form`
// and, as a CSS Grid item, an auto-margined item with no max-width shrinks
// to its fit-content size and centers instead of stretching to fill the
// Card — the nested form ends up a narrow column with big dead gutters on
// both sides. `.cause-tab-form .admin-form` (added below, scoped to this
// panel only) cancels just that centering.
export function CauseSettingsPanel({ cause, recommendation }: CauseSettingsPanelProps) {
  const router = useRouter();
  const profileRef = useRef<SaveFormHandle>(null);
  const payoutRef = useRef<SaveFormHandle>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPayouts, setSavingPayouts] = useState(false);

  async function handleSaveProfile() {
    setSavingProfile(true);
    await profileRef.current?.submit();
    setSavingProfile(false);
    router.refresh();
  }

  async function handleSavePayouts() {
    setSavingPayouts(true);
    await payoutRef.current?.submit();
    setSavingPayouts(false);
    router.refresh();
  }

  return (
    <>
      <Tabs defaultValue="profile">
        <TabsList aria-label="Cause settings sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Organization profile</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded cause-tab-form">
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
              <Button type="button" variant="form" className="mt-3" onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? "Saving…" : "Save profile"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded cause-tab-form">
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
              <Button type="button" variant="form" className="mt-3" onClick={handleSavePayouts} disabled={savingPayouts}>
                {savingPayouts ? "Saving…" : "Save payout settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/account" className={buttonVariants({ variant: "outline" })}>
          Back to My Account
        </Link>
      </p>
    </>
  );
}
