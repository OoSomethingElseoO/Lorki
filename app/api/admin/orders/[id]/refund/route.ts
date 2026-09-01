import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { processRefund } from "@/lib/refunds";
import { sendRefundConfirmationEmail } from "@/lib/email";

type RouteParams = { params: Promise<{ id: string }> };

// Deliberately no status guard beyond "not already refunded" — a DELIVERED
// order can still be refunded (any already-RELEASED payouts just won't be
// clawed back automatically; that's the existing, correct design).
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const order = await prisma.order.findUnique({ where: { id }, include: { artwork: true } });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status === "REFUNDED") {
    return NextResponse.json({ error: "Order has already been refunded" }, { status: 409 });
  }

  if (order.paymentMethod === "STRIPE") {
    try {
      const stripe = await getStripe();
      await stripe.refunds.create({ payment_intent: order.stripePaymentIntentId! });
    } catch (error) {
      return NextResponse.json({ error: `Stripe refund failed: ${(error as Error).message}` }, { status: 502 });
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

  return NextResponse.json({ order: updated });
}
