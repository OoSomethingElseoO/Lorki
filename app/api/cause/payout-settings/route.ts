import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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

// Conservancy-side mirror of /api/seller/payout-settings, plus one thing
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

  if (body.payoutChannel === "FLUTTERWAVE") {
    const country = body.payoutCountry?.trim() ?? "";
    const currency = body.payoutCurrency?.trim() ?? "";
    const accountNumber = body.payoutAccountNumber?.trim() ?? "";
    const accountHolderName = body.payoutAccountHolderName?.trim() ?? "";
    const usingMobileMoney = Boolean(body.payoutMobileNetwork?.trim());

    if (!country || !currency || !accountNumber || !accountHolderName) {
      return NextResponse.json(
        { error: "payoutCountry, payoutCurrency, payoutAccountNumber, and payoutAccountHolderName are required" },
        { status: 400 },
      );
    }
    if (!usingMobileMoney && !body.payoutBankCode?.trim()) {
      return NextResponse.json(
        { error: "Set either payoutMobileNetwork (mobile money) or payoutBankCode (bank transfer)" },
        { status: 400 },
      );
    }
  }

  if (body.payoutChannel === "CRYPTO") {
    if (!body.cryptoNetwork?.trim() || !body.cryptoAddress?.trim()) {
      return NextResponse.json({ error: "cryptoNetwork and cryptoAddress are required" }, { status: 400 });
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
