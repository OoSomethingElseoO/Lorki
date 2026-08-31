"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArtistProfileForm } from "@/components/artist-profile-form";
import { PayoutSettingsForm } from "@/components/payout-settings-form";
import type { SaveFormHandle } from "@/components/cause-profile-form";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ArtistSettingsPanelProps = {
  artist: {
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

// Profile and Payouts are independently-savable tabs, each with its own
// Save action — editing your bio never touches payout fields, and vice
// versa. Used to be one shared "Save changes" button driving both forms
// via an imperative ref.submit() call on each (see git history /
// DASHBOARD_UX_AUDIT.md) — a real hazard, since resubmitting bank details
// just to fix a typo in your bio (or the reverse) isn't something an artist
// should ever have to risk.
//
// ArtistProfileForm is now fully self-contained (own form, own fetch, own
// Save button) so it needs no ref at all. PayoutSettingsForm is shared
// with the cause side (components/cause-settings-panel.tsx) and still only
// exposes an imperative submit() — not touching its external API here, so
// it keeps its ref, just no longer sharing that ref's trigger with the
// profile form.
//
// CardContent gets "admin-form admin-form--embedded" so the existing
// `.admin-form .admin-form` CSS rule strips the nested form's own box
// (ArtistProfileForm's <form className="admin-form">, PayoutSettingsForm's
// outer <div className="admin-form">) instead of rendering a second
// bordered box inside the Card's own box. It also gets "artist-tab-form":
// `.dashboard-main--brand .admin-form` centers a standalone .admin-form via
// `margin-left/right: auto`, which only looks right when that form still
// has its own max-width — once nested here, max-width resets to none (via
// `.admin-form .admin-form`), and a CSS Grid item with auto margins and no
// max-width shrinks to fit-content and centers instead of stretching,
// leaving the fields in a narrow column with big dead gutters on both
// sides. `.artist-tab-form .admin-form` (app/globals.css) cancels just
// that centering — same fix as `.cause-tab-form` on the cause side, kept
// as its own class since the two panels are maintained independently.
export function ArtistSettingsPanel({ artist, recommendation }: ArtistSettingsPanelProps) {
  const router = useRouter();
  const payoutRef = useRef<SaveFormHandle>(null);
  const [payoutSaving, setPayoutSaving] = useState(false);

  async function handleSavePayouts() {
    setPayoutSaving(true);
    await payoutRef.current?.submit();
    setPayoutSaving(false);
    router.refresh();
  }

  return (
    <>
      <Tabs defaultValue="profile">
        <TabsList aria-label="Artist settings sections">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded artist-tab-form">
              <ArtistProfileForm
                initial={{ name: artist.name, country: artist.country, bio: artist.bio, imageUrl: artist.imageUrl }}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Payouts</CardTitle>
            </CardHeader>
            <CardContent className="admin-form admin-form--embedded artist-tab-form">
              <PayoutSettingsForm
                ref={payoutRef}
                initial={{
                  payoutChannel: artist.payoutChannel,
                  payoutCountry: artist.payoutCountry,
                  payoutCurrency: artist.payoutCurrency,
                  payoutMobileNetwork: artist.payoutMobileNetwork,
                  payoutAccountNumber: artist.payoutAccountNumber,
                  payoutBankCode: artist.payoutBankCode,
                  stripeConnectOnboarded: artist.stripeConnectOnboarded,
                  cryptoNetwork: artist.cryptoNetwork,
                  cryptoAddress: artist.cryptoAddress,
                }}
                recommendation={recommendation}
                endpoint="/api/artist/payout-settings"
                connectOnboardEndpoint="/api/artist/connect/onboard"
              />
              <Button type="button" variant="form" className="mt-3" onClick={handleSavePayouts} disabled={payoutSaving}>
                {payoutSaving ? "Saving…" : "Save payout settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/artist" className={buttonVariants({ variant: "outline" })}>
          Back to Dashboard
        </Link>
      </p>
    </>
  );
}
