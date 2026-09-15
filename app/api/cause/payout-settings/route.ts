import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validatePayoutSettings, validateTextField } from "@/lib/validation";

type PayoutSettingsBody = {
  payoutChannel: "MANUAL" | "FLUTTERWAVE" | "CRYPTO";
  payoutCountry?: string;
  payoutCurrency?: string;
  payoutMobileNetwork?: string;
  payoutAccountNumber?: string;
  payoutBankCode?: string;
  payoutAccountHolderName?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
};

const VALID_CHANNELS = ["MANUAL", "FLUTTERWAVE", "CRYPTO"];

// Conservancy-side mirror of /api/artist/payout-settings, plus one thing
// that only matters for a cause (not an individual artist):
// payoutAccountHolderName. Money should go to the organization's own
// account, not an individual's personal M-Pesa number — an admin checks
// this name actually matches the org's registered name as part of
// verification (see /api/admin/conservancies/[id]/verify). STRIPE_CONNECT
// is set separately, from /api/cause/connect/onboard, and needs no
// separate name check — Stripe's own onboarding already verifies the
// connected account's identity.
export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const cause = currentUser?.conservancy;
  if (!cause) {
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

  // ✅ Account holder name validation (org name, not individual)
  if (body.payoutChannel === "FLUTTERWAVE") {
    const nameError = validateTextField(body.payoutAccountHolderName || "", {
      minLength: 1,
      maxLength: 200,
      name: "Account holder name",
    });
    if (nameError) {
      return NextResponse.json({ error: nameError }, { status: 400 });
    }
  }

  const nextAccountHolderName = body.payoutChannel === "FLUTTERWAVE" ? body.payoutAccountHolderName!.trim() : null;
  // An admin verified the OLD name against the org's registered name —
  // changing it (or switching off FLUTTERWAVE entirely) invalidates that
  // specific check and overall verification, same reasoning as a
  // name/registration-number change in /api/cause/profile.
  const accountHolderNameChanged = nextAccountHolderName !== cause.payoutAccountHolderName;
  const needsReverification = accountHolderNameChanged && cause.verifiedAt !== null;

  const conservancy = await prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      payoutChannel: body.payoutChannel,
      payoutCountry: body.payoutChannel === "FLUTTERWAVE" ? body.payoutCountry!.trim() : null,
      payoutCurrency: body.payoutChannel === "FLUTTERWAVE" ? body.payoutCurrency!.trim() : null,
      payoutMobileNetwork: body.payoutChannel === "FLUTTERWAVE" ? body.payoutMobileNetwork?.trim() || null : null,
      payoutAccountNumber: body.payoutChannel === "FLUTTERWAVE" ? body.payoutAccountNumber!.trim() : null,
      payoutBankCode: body.payoutChannel === "FLUTTERWAVE" ? body.payoutBankCode?.trim() || null : null,
      payoutAccountHolderName: nextAccountHolderName,
      cryptoNetwork: body.payoutChannel === "CRYPTO" ? body.cryptoNetwork!.trim() : null,
      cryptoAddress: body.payoutChannel === "CRYPTO" ? body.cryptoAddress!.trim() : null,
      ...(needsReverification ? { verifiedAt: null, payoutNameCheckedAt: null } : {}),
    },
  });

  return NextResponse.json({ conservancy });
}
