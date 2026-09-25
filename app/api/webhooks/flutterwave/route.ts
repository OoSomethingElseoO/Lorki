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

  const externalEventId = event?.id ? String(event.id) : `${transferId}:${status}`;
  let providerEvent;
  try {
    providerEvent = await prisma.paymentProviderEvent.create({
      data: { provider: "FLUTTERWAVE", externalId: externalEventId, eventType: "transfer.status", payload: JSON.parse(JSON.stringify(event)) },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return NextResponse.json({ received: true, duplicate: true });
    throw error;
  }

  // ✅ IDEMPOTENCY: Check if we already processed this transfer
  const payout = await prisma.payout.findFirst({ where: { flutterwaveTransferId: transferId }, include: { order: { select: { currency: true } } } });
  if (!payout) {
    console.error(`[flutterwave:webhook] Payout not found for transfer ${transferId}`);
    await prisma.paymentReconciliation.create({
      data: { provider: "FLUTTERWAVE", externalId: transferId, eventType: "transfer.status", status: "MISSING_LOCAL_ORDER", metadata: JSON.parse(JSON.stringify({ status, event })) },
    }).catch(() => undefined);
    await prisma.paymentProviderEvent.update({ where: { id: providerEvent.id }, data: { status: "FAILED", error: "Payout not found" } });
    sendOperationsAlert(
      "Flutterwave payout has no local record",
      `<p>Transfer <code>${transferId}</code> reported ${status} but no local payout was found. Review reconciliation immediately.</p>`,
    ).catch((error) => console.error("[flutterwave:reconciliation-alert-failed]", error));
    return NextResponse.json({ received: true });
  }

  // ✅ IDEMPOTENCY: If payout already has this status, webhook is being retried (idempotent)
  if (payout.flutterwaveTransferStatus === status) {
    console.log(`[flutterwave:webhook] ℹ Duplicate webhook for transfer ${transferId}, status already ${status}`);
    await prisma.paymentProviderEvent.update({ where: { id: providerEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });
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

  const actualAmountCents = typeof data?.amount === "number" ? Math.round(data.amount * 100) : null;
  const actualCurrency = typeof data?.currency === "string" ? data.currency : null;
  const amountMatches = actualAmountCents === null || actualAmountCents === payout.amountCents;
  const expectedCurrency = payout.order.currency;
  const currencyMatches = actualCurrency === null || actualCurrency.toLowerCase() === expectedCurrency.toLowerCase();
  if (!amountMatches || !currencyMatches) {
    await prisma.paymentReconciliation.create({
      data: {
        provider: "FLUTTERWAVE",
        externalId: transferId,
        payoutId: payout.id,
        expectedAmountCents: payout.amountCents,
        actualAmountCents,
        expectedCurrency,
        actualCurrency,
        differenceCents: actualAmountCents === null ? null : actualAmountCents - payout.amountCents,
        status: !currencyMatches ? "CURRENCY_MISMATCH" : "PAYOUT_MISMATCH",
        eventType: "transfer.status",
        metadata: JSON.parse(JSON.stringify({ status, providerEventId: externalEventId })),
      },
    }).catch(() => undefined);
  }
  await prisma.paymentProviderEvent.update({ where: { id: providerEvent.id }, data: { status: "PROCESSED", processedAt: new Date() } });

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
