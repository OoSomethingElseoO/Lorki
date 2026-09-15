import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { processRefund } from "@/lib/refunds";
import { sendRefundConfirmationEmail } from "@/lib/email";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { checkIdempotency, storeIdempotencyResponse } from "@/lib/idempotency";

type RouteParams = { params: Promise<{ id: string }> };

// Deliberately no status guard beyond "not already refunded" — a DELIVERED
// order can still be refunded (any already-RELEASED payouts just won't be
// clawed back automatically; that's the existing, correct design).
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) {
    return unauthorized("FINANCE_ADMIN");
  }

  // ✅ Check for idempotent retry
  const cached = await checkIdempotency(request, user?.id);
  if (cached) return cached;

  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, include: { artwork: true } });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "REFUNDED") {
    const response = NextResponse.json({ error: "Order has already been refunded" }, { status: 409 });
    // ✅ Store for future retries
    await storeIdempotencyResponse(
      request.headers.get("Idempotency-Key") || "no-key",
      user?.id,
      409,
      { error: "Order has already been refunded" }
    ).catch((e) => console.error("[idempotency:storage-failed]", e));
    return response;
  }

  if (order.paymentMethod === "STRIPE") {
    if (!order.stripePaymentIntentId) {
      return NextResponse.json({ error: "No Stripe payment intent on file — cannot refund" }, { status: 400 });
    }
    try {
      const stripe = await getStripe();
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId });
    } catch (error) {
      const errorResponse = NextResponse.json({
        error: `Stripe refund failed: ${(error as Error).message}`
      }, { status: 502 });
      // ✅ Store error for future retries
      await storeIdempotencyResponse(
        request.headers.get("Idempotency-Key") || "no-key",
        user?.id,
        502,
        { error: `Stripe refund failed: ${(error as Error).message}` }
      ).catch((e) => console.error("[idempotency:storage-failed]", e));
      return errorResponse;
    }
  }

  const updated = await processRefund(order.id);

  // Not awaited — processRefund above already committed, same reasoning as
  // the Stripe webhook (app/api/webhooks/stripe/route.ts).
  sendRefundConfirmationEmail({
    buyerEmail: order.buyerEmail,
    artworkTitle: order.artwork.title,
    amountCents: order.amountCents,
  });

  const response = NextResponse.json({ order: updated });
  // ✅ Store for future retries
  await storeIdempotencyResponse(
    request.headers.get("Idempotency-Key") || "no-key",
    user?.id,
    200,
    { order: updated }
  ).catch((e) => console.error("[idempotency:storage-failed]", e));
  return response;
}
