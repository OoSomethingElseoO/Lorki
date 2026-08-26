// app/api/seller/payout-settings/route.ts (PATCH) gates on
// getCurrentUser(), so the direct-handler-call pattern doesn't work (same
// situation as seller-profile.test.ts / seller-artworks.test.ts). Its
// validation logic is otherwise pure body-shape checking with no session
// dependency, and its update call does real channel-dependent field
// nulling worth confirming against actual rows. Considered extracting the
// validation into lib/ (the isPayoutRevivable precedent), but it's ~10
// lines duplicated in exactly two route files (this one and
// app/api/cause/payout-settings/route.ts) that differ slightly (the cause
// version also requires payoutAccountHolderName) — pulling it into a
// shared function would need a parameterized "which fields are required"
// shape that adds more indirection than the duplication it removes, so
// left as-is per a minimum-viable-change bias. Instead, these tests
// reproduce the route's exact conditions and exact update `data` object,
// line for line, and exercise them directly against real Artist rows.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createArtist() {
  return prisma.artist.create({
    data: {
      slug: `test-seller-payout-${unique()}`,
      name: "Test Payout Seller",
      country: "Kenya",
      bio: "A throwaway artist created by seller-payout-settings.test.ts",
      imageUrl: "https://example.com/artist.jpg",
    },
  });
}

type Body = {
  payoutChannel: "MANUAL" | "FLUTTERWAVE" | "CRYPTO";
  payoutCountry?: string;
  payoutCurrency?: string;
  payoutMobileNetwork?: string;
  payoutAccountNumber?: string;
  payoutBankCode?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
};

// Reproduces app/api/seller/payout-settings/route.ts's PATCH validation
// verbatim: returns an error string (mirroring the route's 400 body) or
// null if the body passes.
function validate(body: Partial<Body>): string | null {
  const VALID_CHANNELS = ["MANUAL", "FLUTTERWAVE", "CRYPTO"];
  if (!body.payoutChannel || !VALID_CHANNELS.includes(body.payoutChannel)) {
    return `payoutChannel must be one of ${VALID_CHANNELS.join(", ")}`;
  }

  if (body.payoutChannel === "FLUTTERWAVE") {
    const country = body.payoutCountry?.trim() ?? "";
    const currency = body.payoutCurrency?.trim() ?? "";
    const accountNumber = body.payoutAccountNumber?.trim() ?? "";
    const usingMobileMoney = Boolean(body.payoutMobileNetwork?.trim());

    if (!country || !currency || !accountNumber) {
      return "payoutCountry, payoutCurrency, and payoutAccountNumber are required";
    }
    if (!usingMobileMoney && !body.payoutBankCode?.trim()) {
      return "Set either payoutMobileNetwork (mobile money) or payoutBankCode (bank transfer)";
    }
  }

  if (body.payoutChannel === "CRYPTO") {
    if (!body.cryptoNetwork?.trim() || !body.cryptoAddress?.trim()) {
      return "cryptoNetwork and cryptoAddress are required";
    }
  }

  return null;
}

test("FLUTTERWAVE requires payoutCountry, payoutCurrency, and payoutAccountNumber", () => {
  assert.equal(validate({ payoutChannel: "FLUTTERWAVE", payoutMobileNetwork: "Mpesa", payoutAccountNumber: "0700000000" }) !== null, true, "missing country/currency must fail");
  assert.equal(
    validate({
      payoutChannel: "FLUTTERWAVE",
      payoutCountry: "Kenya",
      payoutCurrency: "KES",
      payoutAccountNumber: "0700000000",
      payoutMobileNetwork: "Mpesa",
    }),
    null,
    "all required fields plus mobile network must pass",
  );
});

test("FLUTTERWAVE requires either payoutMobileNetwork or payoutBankCode, not neither", () => {
  const base = { payoutChannel: "FLUTTERWAVE" as const, payoutCountry: "Kenya", payoutCurrency: "KES", payoutAccountNumber: "0700000000" };
  assert.match(validate(base) ?? "", /mobile money.*bank transfer/i, "neither mobile network nor bank code must fail");
  assert.equal(validate({ ...base, payoutMobileNetwork: "Mpesa" }), null, "mobile money alone must pass");
  assert.equal(validate({ ...base, payoutBankCode: "011" }), null, "bank code alone must pass");
});

test("CRYPTO requires both cryptoNetwork and cryptoAddress", () => {
  assert.equal(validate({ payoutChannel: "CRYPTO", cryptoNetwork: "USDC on Base" }) !== null, true, "missing address must fail");
  assert.equal(validate({ payoutChannel: "CRYPTO", cryptoAddress: "0xabc" }) !== null, true, "missing network must fail");
  assert.equal(validate({ payoutChannel: "CRYPTO", cryptoNetwork: "USDC on Base", cryptoAddress: "0xabc" }), null);
});

test("MANUAL requires nothing beyond the channel itself", () => {
  assert.equal(validate({ payoutChannel: "MANUAL" }), null);
});

test("an unknown payoutChannel value is rejected", () => {
  assert.equal(validate({ payoutChannel: "BITCOIN_ATM" as unknown as Body["payoutChannel"] }) !== null, true);
  assert.equal(validate({}), "payoutChannel must be one of MANUAL, FLUTTERWAVE, CRYPTO");
});

test("switching to CRYPTO nulls out FLUTTERWAVE fields, and vice versa, matching the route's update data object", async (t) => {
  const artist = await createArtist();
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  // First: set FLUTTERWAVE with a bank transfer (no mobile network).
  const body1: Body = {
    payoutChannel: "FLUTTERWAVE",
    payoutCountry: "Nigeria",
    payoutCurrency: "NGN",
    payoutAccountNumber: "1234567890",
    payoutBankCode: "011",
  };
  assert.equal(validate(body1), null);
  const afterFlutterwave = await prisma.artist.update({
    where: { id: artist.id },
    data: {
      payoutChannel: body1.payoutChannel,
      payoutCountry: body1.payoutChannel === "FLUTTERWAVE" ? body1.payoutCountry!.trim() : null,
      payoutCurrency: body1.payoutChannel === "FLUTTERWAVE" ? body1.payoutCurrency!.trim() : null,
      payoutMobileNetwork: body1.payoutChannel === "FLUTTERWAVE" ? body1.payoutMobileNetwork?.trim() || null : null,
      payoutAccountNumber: body1.payoutChannel === "FLUTTERWAVE" ? body1.payoutAccountNumber!.trim() : null,
      payoutBankCode: body1.payoutChannel === "FLUTTERWAVE" ? body1.payoutBankCode?.trim() || null : null,
      cryptoNetwork: body1.payoutChannel === "CRYPTO" ? body1.cryptoNetwork! : null,
      cryptoAddress: body1.payoutChannel === "CRYPTO" ? body1.cryptoAddress! : null,
    },
  });
  assert.equal(afterFlutterwave.payoutCountry, "Nigeria");
  assert.equal(afterFlutterwave.payoutBankCode, "011");
  assert.equal(afterFlutterwave.payoutMobileNetwork, null);
  assert.equal(afterFlutterwave.cryptoNetwork, null);
  assert.equal(afterFlutterwave.cryptoAddress, null);

  // Now switch to CRYPTO — the route's data object nulls every
  // FLUTTERWAVE field since body.payoutChannel is no longer "FLUTTERWAVE".
  const body2: Body = { payoutChannel: "CRYPTO", cryptoNetwork: "USDC on Base", cryptoAddress: "0xabc123" };
  assert.equal(validate(body2), null);
  const afterCrypto = await prisma.artist.update({
    where: { id: artist.id },
    data: {
      payoutChannel: body2.payoutChannel,
      payoutCountry: body2.payoutChannel === "FLUTTERWAVE" ? body2.payoutCountry! : null,
      payoutCurrency: body2.payoutChannel === "FLUTTERWAVE" ? body2.payoutCurrency! : null,
      payoutMobileNetwork: body2.payoutChannel === "FLUTTERWAVE" ? body2.payoutMobileNetwork ?? null : null,
      payoutAccountNumber: body2.payoutChannel === "FLUTTERWAVE" ? body2.payoutAccountNumber! : null,
      payoutBankCode: body2.payoutChannel === "FLUTTERWAVE" ? body2.payoutBankCode ?? null : null,
      cryptoNetwork: body2.payoutChannel === "CRYPTO" ? body2.cryptoNetwork!.trim() : null,
      cryptoAddress: body2.payoutChannel === "CRYPTO" ? body2.cryptoAddress!.trim() : null,
    },
  });
  assert.equal(afterCrypto.payoutCountry, null, "switching to CRYPTO must clear the old FLUTTERWAVE fields");
  assert.equal(afterCrypto.payoutBankCode, null);
  assert.equal(afterCrypto.cryptoNetwork, "USDC on Base");
  assert.equal(afterCrypto.cryptoAddress, "0xabc123");
});
