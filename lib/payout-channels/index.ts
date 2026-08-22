import { prisma } from "@/lib/prisma";
import { sendOperationsAlert } from "@/lib/email";
import { sendFlutterwavePayout } from "./flutterwave";
import { sendStripeConnectPayout } from "./stripe-connect";
import type { PayoutChannelHandler, PayoutRecipient } from "./types";

const HANDLERS: Record<string, PayoutChannelHandler | undefined> = {
  FLUTTERWAVE: sendFlutterwavePayout,
  STRIPE_CONNECT: sendStripeConnectPayout,
  // MANUAL and CRYPTO have no handler — CRYPTO has no automated sending
  // yet (see the schema comment on PayoutChannel.CRYPTO), so both fall
  // through to the same manual/tracked-obligation path as MANUAL.
};

// Called right after a Payout flips to RELEASED (deliver route, or an
// in-person cash sale) — for both an ARTIST recipient and a CONSERVANCY
// recipient (a cause is just a second kind of payout recipient, see
// PayoutRecipient). Best-effort and self-contained: never throws, never
// blocks the caller's response, and never lets a failed transfer attempt
// affect Payout.status (RELEASED still correctly means "cleared to pay"
// whether or not the automated attempt succeeded) — a failure here just
// means the admin settles it manually, same as any MANUAL-channel
// recipient, plus an alert telling them so.
export async function attemptAutomaticPayout(payoutId: string, recipient: PayoutRecipient): Promise<void> {
  if (recipient.payoutChannel === "MANUAL") {
    return;
  }

  const handler = HANDLERS[recipient.payoutChannel];
  if (!handler) {
    return;
  }

  const payout = await prisma.payout.findUnique({ where: { id: payoutId }, include: { order: true } });
  if (!payout) {
    return;
  }

  try {
    const result = await handler({
      recipient,
      amountCents: payout.amountCents,
      currency: payout.order.currency,
      payoutId: payout.id,
      orderId: payout.orderId,
    });

    if (!result) {
      return;
    }

    const isFlutterwave = recipient.payoutChannel === "FLUTTERWAVE";

    await prisma.payout.update({
      where: { id: payout.id },
      data: {
        ...(isFlutterwave
          ? { flutterwaveTransferId: result.externalRef, flutterwaveTransferStatus: result.status }
          : { stripeTransferId: result.externalRef }),
        ...(result.settledImmediately ? { paidOutAt: new Date() } : {}),
      },
    });
  } catch (error) {
    console.error(`[payout-channels] Automatic payout failed for payout ${payoutId} (recipient ${recipient.id})`, error);
    await sendOperationsAlert(
      `Automatic payout failed`,
      `<p>An automatic payout attempt failed for <strong>${recipient.name}</strong> (channel: ${recipient.payoutChannel}). This payout is still marked RELEASED — it needs to be settled manually. Error: ${(error as Error).message}</p>`,
    );
  }
}
