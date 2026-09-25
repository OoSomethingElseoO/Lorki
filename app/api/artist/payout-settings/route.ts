import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validatePayoutSettings } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

type PayoutSettingsBody = {
  payoutChannel: "MANUAL" | "FLUTTERWAVE" | "CRYPTO";
  payoutCountry?: string;
  payoutCurrency?: string;
  payoutMobileNetwork?: string;
  payoutAccountNumber?: string;
  payoutBankCode?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
};

const VALID_CHANNELS = ["MANUAL", "FLUTTERWAVE", "CRYPTO"];

// STRIPE_CONNECT is set separately, from /api/artist/connect/onboard, since
// choosing it kicks off Stripe's hosted onboarding redirect rather than
// just saving fields. FLUTTERWAVE covers any of Flutterwave's 30+
// countries — mobile money (payoutMobileNetwork set) or bank transfer
// (payoutBankCode set instead) — nothing here is Kenya- or M-Pesa-specific.
// CRYPTO has no automated sending yet (see the schema comment on
// PayoutChannel.CRYPTO) — the wallet details just need to be captured so
// an admin can send to them manually.
export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const currentArtist = currentUser?.artist;
  if (!currentArtist) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<PayoutSettingsBody>;

  if (!body.payoutChannel || !VALID_CHANNELS.includes(body.payoutChannel)) {
    return NextResponse.json({ error: `payoutChannel must be one of ${VALID_CHANNELS.join(", ")}` }, { status: 400 });
  }

  // ✅ Comprehensive validation
  const validation = validatePayoutSettings({
    payoutChannel: body.payoutChannel,
    payoutCountry: body.payoutCountry,
    payoutCurrency: body.payoutCurrency,
    payoutMobileNetwork: body.payoutMobileNetwork,
    payoutAccountNumber: body.payoutAccountNumber,
    payoutBankCode: body.payoutBankCode,
  });

  if (!validation.isValid) {
    return NextResponse.json({ errors: validation.errors }, { status: 400 });
  }

  const artist = await prisma.artist.update({
    where: { id: currentArtist.id },
    data: {
      payoutChannel: body.payoutChannel,
      payoutCountry: body.payoutChannel === "FLUTTERWAVE" ? body.payoutCountry!.trim() : null,
      payoutCurrency: body.payoutChannel === "FLUTTERWAVE" ? body.payoutCurrency!.trim() : null,
      payoutMobileNetwork: body.payoutChannel === "FLUTTERWAVE" ? body.payoutMobileNetwork?.trim() || null : null,
      payoutAccountNumber: body.payoutChannel === "FLUTTERWAVE" ? body.payoutAccountNumber!.trim() : null,
      payoutBankCode: body.payoutChannel === "FLUTTERWAVE" ? body.payoutBankCode?.trim() || null : null,
      cryptoNetwork: body.payoutChannel === "CRYPTO" ? body.cryptoNetwork!.trim() : null,
      cryptoAddress: body.payoutChannel === "CRYPTO" ? body.cryptoAddress!.trim() : null,
    },
  });
  await recordAudit({ action: "ARTIST_PAYOUT_SETTINGS_UPDATED", affectedEntityType: "Artist", affectedEntityId: currentArtist.id, reason: "Artist updated payout settings", changedBy: currentUser!.email, metadata: { payoutChannel: body.payoutChannel, payoutCountry: body.payoutCountry ?? null, payoutCurrency: body.payoutCurrency ?? null, accountDetailsChanged: true } });

  return NextResponse.json({ artist });
}
