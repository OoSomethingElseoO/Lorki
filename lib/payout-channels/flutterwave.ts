import { getFlutterwaveSecretKey } from "@/lib/settings";
import type { PayoutChannelHandler } from "./types";

// Sends a real payout via Flutterwave's direct-transfers API — mobile
// money (M-Pesa in Kenya or Ethiopia, MTN/Airtel elsewhere) or bank
// transfer (e.g. South Africa, Nigeria), whichever the recipient (an
// artist or a cause — see PayoutRecipient) configured. Nothing here is
// country-specific: which type/network/currency applies comes entirely
// from the recipient's own stored payout details, so adding support for
// another of Flutterwave's 30+ countries is a matter of entering the
// right details, not a code change.
//
// Verified against Flutterwave's published docs (Aug 2026) for both the
// mobile_money and bank request shapes — third-party API surfaces shift,
// so re-check the exact endpoint/payload in Flutterwave's dashboard/sandbox
// with the business's real account before relying on this in production.
// Sandbox host shown here; swap to the live host once verified. The bank
// recipient object in particular is documented as varying by destination
// country (e.g. Nigeria/South Africa just need code+account_number, the US
// needs a routing number too) — this implements the common
// code+account_number shape; a country needing more fields will need this
// object extended, not a redesign.
const FLUTTERWAVE_TRANSFERS_URL = "https://developersandbox-api.flutterwave.com/direct-transfers";

// The amount is denominated in the order's own currency (USD) and passed
// as the *source* currency value — Flutterwave converts to the
// recipient's own payoutCurrency using its own live rate, so this
// integration never needs to track or guess an FX rate itself.
const SOURCE_CURRENCY = "USD";

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { first: parts[0], last: parts[0] };
  }
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export const sendFlutterwavePayout: PayoutChannelHandler = async ({ recipient, amountCents, payoutId }) => {
  if (!recipient.payoutCountry || !recipient.payoutCurrency || !recipient.payoutAccountNumber) {
    return null;
  }

  const secretKey = await getFlutterwaveSecretKey();
  if (!secretKey) {
    return null;
  }

  const { first, last } = splitName(recipient.name);
  const isMobileMoney = Boolean(recipient.payoutMobileNetwork);

  if (!isMobileMoney && !recipient.payoutBankCode) {
    // Configured for bank transfer but missing the bank code — not
    // actually sendable yet. Same as "not configured," not an error.
    return null;
  }

  const recipientPayload = isMobileMoney
    ? { name: { first, last }, mobile_money: { network: recipient.payoutMobileNetwork, msisdn: recipient.payoutAccountNumber } }
    : { name: { first, last }, bank: { code: recipient.payoutBankCode, account_number: recipient.payoutAccountNumber } };

  const response = await fetch(FLUTTERWAVE_TRANSFERS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
      "X-Trace-Id": `payout-${payoutId}`,
      "X-Idempotency-Key": `payout-${payoutId}`,
    },
    body: JSON.stringify({
      action: "instant",
      type: isMobileMoney ? "mobile_money" : "bank",
      payment_instruction: {
        source_currency: SOURCE_CURRENCY,
        destination_currency: recipient.payoutCurrency,
        amount: {
          applies_to: "source_currency",
          value: amountCents / 100,
        },
        recipient: recipientPayload,
      },
      narration: "Lorki payout",
      reference: `payout-${payoutId}`,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Flutterwave transfer failed (${response.status}): ${JSON.stringify(data)}`);
  }

  const transferId: string | undefined = data.data?.id ?? data.id;
  const status: string = data.data?.status ?? data.status ?? "NEW";

  if (!transferId) {
    throw new Error(`Flutterwave transfer response missing an id: ${JSON.stringify(data)}`);
  }

  // Flutterwave transfers start "NEW" and confirm asynchronously via
  // webhook (app/api/webhooks/flutterwave/route.ts) — never settled here.
  return { externalRef: transferId, status, settledImmediately: false };
};
