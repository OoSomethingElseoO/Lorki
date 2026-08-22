import { getStripe } from "@/lib/stripe";
import type { PayoutChannelHandler } from "./types";

// Separate-charges-and-transfers pattern: the buyer's payment already
// landed in the platform's own Stripe balance at checkout, and this fires
// a real Stripe Transfer out of that balance to the recipient's (an
// artist or a cause) connected account. Deliberately a separate step at
// release time (not transfer_data on the original Checkout Session) — the
// whole point of this app's payout design is that money must not move
// until the buyer has the piece (see the deliver route), and a
// Checkout-time transfer would fire immediately at purchase instead.
export const sendStripeConnectPayout: PayoutChannelHandler = async ({ recipient, amountCents, currency, payoutId }) => {
  if (!recipient.stripeConnectedAccountId || !recipient.stripeConnectOnboarded) {
    return null;
  }

  const stripe = await getStripe();

  const transfer = await stripe.transfers.create({
    amount: amountCents,
    currency,
    destination: recipient.stripeConnectedAccountId,
    transfer_group: `payout-${payoutId}`,
  });

  // Stripe Transfers move funds to the connected account's Stripe balance
  // synchronously — Stripe's own payout schedule from there to the
  // recipient's bank is between them and Stripe, same as any Standard
  // account, so this counts as settled from Lorki's side immediately.
  return { externalRef: transfer.id, status: "paid", settledImmediately: true };
};
