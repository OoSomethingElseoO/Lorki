import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { computeSplit } from "@/lib/payouts";
import { sendOperationsAlert, sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    return NextResponse.json({ error: `Invalid signature: ${(error as Error).message}` }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
  }

  if (event.type === "charge.refunded") {
    await handleRefund(event.data.object as Stripe.Charge);
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  const artworkId = session.metadata?.artworkId;

  if (!paymentIntentId || !artworkId) {
    return;
  }

  // Idempotency: Stripe retries webhook delivery, so a payment_intent we've
  // already recorded an Order for must be a no-op, not a duplicate Order.
  const existing = await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (existing) {
    return;
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    include: { campaign: true },
  });

  if (!artwork) {
    return;
  }

  const shipping = session.collected_information?.shipping_details ?? session.customer_details;
  const address = shipping?.address;

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        artworkId: artwork.id,
        buyerEmail: session.customer_details?.email ?? session.customer_email ?? "unknown@buyer",
        shippingName: shipping?.name ?? "Unknown",
        shippingAddressLine1: address?.line1 ?? "",
        shippingAddressLine2: address?.line2 ?? null,
        shippingCity: address?.city ?? "",
        shippingRegion: address?.state ?? "",
        shippingPostalCode: address?.postal_code ?? "",
        shippingCountry: address?.country ?? "",
        amountCents: session.amount_total ?? artwork.priceCents,
        currency: artwork.currency,
        stripePaymentIntentId: paymentIntentId,
        status: "PAID",
      },
    });

    if (artwork.kind === "ORIGINAL") {
      await tx.artwork.update({
        where: { id: artwork.id },
        data: { inventoryState: "SOLD", reservedAt: null },
      });
    }

    const split = computeSplit(order.amountCents, artwork.campaign);

    await tx.payout.createMany({
      data: [
        { orderId: order.id, recipientType: "ARTIST", recipientId: artwork.campaign.artistId, amountCents: split.artistCents },
        { orderId: order.id, recipientType: "CONSERVANCY", recipientId: artwork.campaign.animalId, amountCents: split.conservancyCents },
        { orderId: order.id, recipientType: "OPERATIONS", recipientId: "operations", amountCents: split.operationsCents },
      ],
    });

    return order;
  });

  await sendOrderConfirmationEmail({
    buyerEmail: order.buyerEmail,
    artworkTitle: artwork.title,
    amountCents: order.amountCents,
  });

  await sendOperationsAlert(
    `New order: ${artwork.title}`,
    `<p>${order.buyerEmail} bought <strong>${artwork.title}</strong> for $${(order.amountCents / 100).toFixed(2)}.</p><p>Fulfillment needed — mark it shipped in the admin once it's on its way.</p>`,
  );
}

async function handleRefund(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  if (!paymentIntentId) {
    return;
  }

  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId } });
  if (!order) {
    return;
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } }),
    // PENDING payouts must never release after a refund; RELEASED ones need
    // manual clawback tracked outside this table, so we only guard the
    // still-pending side here.
    prisma.payout.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "FAILED" },
    }),
  ]);
}
