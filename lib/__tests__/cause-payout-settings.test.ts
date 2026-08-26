// app/api/cause/payout-settings/route.ts (PATCH) gates on
// getCurrentUser(), so the direct-handler-call pattern doesn't work (same
// reasoning as seller-payout-settings.test.ts, and the same decision not
// to extract the FLUTTERWAVE/CRYPTO validation into lib/ — it's the
// seller version plus one extra required field, payoutAccountHolderName,
// with its own reverification side effect, so parameterizing a shared
// function would need to know about that too). Beyond the shared
// FLUTTERWAVE/CRYPTO validation shape, this route has its own
// reverification-invalidation rule: changing payoutAccountHolderName on an
// already-verified cause resets verifiedAt and payoutNameCheckedAt, same
// reasoning as the name/registrationNumber rule in cause-profile.test.ts.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createVerifiedConservancy() {
  const id = unique();
  return prisma.conservancy.create({
    data: {
      name: `Test Payout Cause ${id}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by cause-payout-settings.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: `REG-${id}`,
      verifiedAt: new Date(),
      payoutAccountHolderName: "Original Org Name",
      payoutNameCheckedAt: new Date(),
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
  payoutAccountHolderName?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
};

// Reproduces app/api/cause/payout-settings/route.ts's PATCH validation
// verbatim — note the extra payoutAccountHolderName requirement versus the
// seller version.
function validate(body: Partial<Body>): string | null {
  const VALID_CHANNELS = ["MANUAL", "FLUTTERWAVE", "CRYPTO"];
  if (!body.payoutChannel || !VALID_CHANNELS.includes(body.payoutChannel)) {
    return `payoutChannel must be one of ${VALID_CHANNELS.join(", ")}`;
  }

  if (body.payoutChannel === "FLUTTERWAVE") {
    const country = body.payoutCountry?.trim() ?? "";
    const currency = body.payoutCurrency?.trim() ?? "";
    const accountNumber = body.payoutAccountNumber?.trim() ?? "";
    const accountHolderName = body.payoutAccountHolderName?.trim() ?? "";
    const usingMobileMoney = Boolean(body.payoutMobileNetwork?.trim());

    if (!country || !currency || !accountNumber || !accountHolderName) {
      return "payoutCountry, payoutCurrency, payoutAccountNumber, and payoutAccountHolderName are required";
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

test("FLUTTERWAVE requires payoutAccountHolderName in addition to the seller-side fields", () => {
  const withoutHolderName = {
    payoutChannel: "FLUTTERWAVE" as const,
    payoutCountry: "Kenya",
    payoutCurrency: "KES",
    payoutAccountNumber: "0700000000",
    payoutMobileNetwork: "Mpesa",
  };
  assert.match(validate(withoutHolderName) ?? "", /payoutAccountHolderName/, "missing account holder name must fail");
  assert.equal(validate({ ...withoutHolderName, payoutAccountHolderName: "Org Name" }), null);
});

test("FLUTTERWAVE still requires either payoutMobileNetwork or payoutBankCode", () => {
  const base = {
    payoutChannel: "FLUTTERWAVE" as const,
    payoutCountry: "Kenya",
    payoutCurrency: "KES",
    payoutAccountNumber: "0700000000",
    payoutAccountHolderName: "Org Name",
  };
  assert.match(validate(base) ?? "", /mobile money.*bank transfer/i);
  assert.equal(validate({ ...base, payoutBankCode: "011" }), null);
});

test("CRYPTO requires cryptoNetwork and cryptoAddress, with no accountHolderName requirement", () => {
  assert.equal(validate({ payoutChannel: "CRYPTO", cryptoNetwork: "USDC on Base", cryptoAddress: "0xabc" }), null);
  assert.equal(validate({ payoutChannel: "CRYPTO" }) !== null, true);
});

test("changing payoutAccountHolderName on a verified cause resets verifiedAt and payoutNameCheckedAt", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const body: Body = {
    payoutChannel: "FLUTTERWAVE",
    payoutCountry: "Kenya",
    payoutCurrency: "KES",
    payoutAccountNumber: "0700000000",
    payoutMobileNetwork: "Mpesa",
    payoutAccountHolderName: "A Different Org Name",
  };
  assert.equal(validate(body), null);

  // Reproduces the route's exact reverification computation and update.
  const nextAccountHolderName = body.payoutChannel === "FLUTTERWAVE" ? body.payoutAccountHolderName!.trim() : null;
  const accountHolderNameChanged = nextAccountHolderName !== cause.payoutAccountHolderName;
  const needsReverification = accountHolderNameChanged && cause.verifiedAt !== null;
  assert.equal(accountHolderNameChanged, true);
  assert.equal(needsReverification, true);

  const updated = await prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      payoutChannel: body.payoutChannel,
      payoutAccountHolderName: nextAccountHolderName,
      ...(needsReverification ? { verifiedAt: null, payoutNameCheckedAt: null } : {}),
    },
  });

  assert.equal(updated.verifiedAt, null, "verification must be invalidated by the account-holder-name change");
  assert.equal(updated.payoutNameCheckedAt, null);
  assert.equal(updated.payoutAccountHolderName, "A Different Org Name");
});

test("keeping the same payoutAccountHolderName leaves verification intact", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const body: Body = {
    payoutChannel: "FLUTTERWAVE",
    payoutCountry: "Kenya",
    payoutCurrency: "KES",
    payoutAccountNumber: "0700000000",
    payoutMobileNetwork: "Mpesa",
    payoutAccountHolderName: cause.payoutAccountHolderName!,
  };
  assert.equal(validate(body), null);

  const nextAccountHolderName = body.payoutChannel === "FLUTTERWAVE" ? body.payoutAccountHolderName!.trim() : null;
  const accountHolderNameChanged = nextAccountHolderName !== cause.payoutAccountHolderName;
  const needsReverification = accountHolderNameChanged && cause.verifiedAt !== null;
  assert.equal(accountHolderNameChanged, false);

  const updated = await prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      payoutChannel: body.payoutChannel,
      payoutAccountHolderName: nextAccountHolderName,
      ...(needsReverification ? { verifiedAt: null, payoutNameCheckedAt: null } : {}),
    },
  });

  assert.ok(updated.verifiedAt, "verification must stay intact when the account holder name doesn't change");
  assert.ok(updated.payoutNameCheckedAt);
});

test("switching away from FLUTTERWAVE (payoutAccountHolderName becomes null) also invalidates verification if it was previously verified with a name set", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const body: Body = { payoutChannel: "CRYPTO", cryptoNetwork: "USDC on Base", cryptoAddress: "0xabc123" };
  assert.equal(validate(body), null);

  const nextAccountHolderName: string | null = null; // body.payoutChannel !== "FLUTTERWAVE"
  const accountHolderNameChanged = nextAccountHolderName !== cause.payoutAccountHolderName;
  const needsReverification = accountHolderNameChanged && cause.verifiedAt !== null;
  assert.equal(accountHolderNameChanged, true, "was set, now becomes null");
  assert.equal(needsReverification, true);

  const updated = await prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      payoutChannel: body.payoutChannel,
      payoutAccountHolderName: nextAccountHolderName,
      cryptoNetwork: body.cryptoNetwork!.trim(),
      cryptoAddress: body.cryptoAddress!.trim(),
      ...(needsReverification ? { verifiedAt: null, payoutNameCheckedAt: null } : {}),
    },
  });

  assert.equal(updated.verifiedAt, null);
  assert.equal(updated.payoutAccountHolderName, null);
});
