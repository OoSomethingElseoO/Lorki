import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFlutterwaveWebhookSecret } from "@/lib/settings";
import { sendOperationsAlert } from "@/lib/email";

// Flutterwave transfers start "NEW" (see lib/payout-channels/mpesa-flutterwave.ts)
// and confirm asynchronously here. Verification uses Flutterwave's
// verif-hash header — a shared secret configured in both the Flutterwave
// dashboard and /admin/settings, compared directly (not HMAC-signed) per
// Flutterwave's documented pattern. Re-check this against the account's
// actual dashboard webhook settings before relying on it — Flutterwave has
// more than one API generation and the exact header can vary by account.
export async function POST(request: Request) {
  const expectedSecret = await getFlutterwaveWebhookSecret();
  const receivedSecret = request.headers.get("verif-hash");

  if (!expectedSecret || !receivedSecret || receivedSecret !== expectedSecret) {
    console.error("[flutterwave:webhook] Invalid or missing webhook signature");
    return NextResponse.json({ error: "Invalid or missing webhook signature" }, { status: 400 });
  }

  const event = await request.json().catch(() => null);
  const data = event?.data;
  const transferId: string | undefined = data?.id ? String(data.id) : undefined;
  const status: string | undefined = data?.status;

  if (!transferId || !status) {
    console.warn("[flutterwave:webhook] Missing transferId or status", { transferId, status });
    return NextResponse.json({ received: true });
  }

  console.log(`[flutterwave:webhook] Received transfer status update: ${transferId} → ${status}`);

  // ✅ IDEMPOTENCY: Check if we already processed this transfer
  const payout = await prisma.payout.findFirst({ where: { flutterwaveTransferId: transferId } });
  if (!payout) {
    console.error(`[flutterwave:webhook] Payout not found for transfer ${transferId}`);
    return NextResponse.json({ received: true });
  }

  // ✅ IDEMPOTENCY: If payout already has this status, webhook is being retried (idempotent)
  if (payout.flutterwaveTransferStatus === status) {
    console.log(`[flutterwave:webhook] ℹ Duplicate webhook for transfer ${transferId}, status already ${status}`);
    return NextResponse.json({ received: true }); // Return success (idempotent)
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: {
      flutterwaveTransferStatus: status,
      ...(status === "SUCCESSFUL" ? { paidOutAt: new Date() } : {}),
      ...(status === "FAILED" ? { status: "FAILED" } : {}),
    },
  });

  console.log(`[flutterwave:webhook] ✓ Payout updated: ${payout.id} status=${status}`);

  if (status === "FAILED") {
    console.error(`[flutterwave:webhook] ⚠ Transfer failed: ${transferId} (payout ${payout.id})`);
    // Not awaited — the payout row is already updated above; same reasoning
    // as the Stripe webhook (app/api/webhooks/stripe/route.ts), don't make
    // this response wait on Resend.
    sendOperationsAlert(
      "Automatic M-Pesa payout failed",
      `<p>A Flutterwave transfer (payout ${payout.id}, $${(payout.amountCents / 100).toFixed(2)}) came back FAILED. It's still marked RELEASED — it needs to be paid out manually.</p>`,
    ).catch((e) => console.error("[flutterwave:payout-failed-alert-failed]", e));
  }

  return NextResponse.json({ received: true });
}
