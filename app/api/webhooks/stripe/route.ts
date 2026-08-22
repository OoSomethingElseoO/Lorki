import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getStripeWebhookSecret } from "@/lib/settings";
import { computeSplit, getCampaignConservancyId } from "@/lib/payouts";
import { processRefund } from "@/lib/refunds";
import { sendOperationsAlert, sendOrderConfirmationEmail } from "@/lib/email";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = await getStripeWebhookSecret();

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing webhook signature or secret" }, { status: 400 });
  }

  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    const stripe = await getStripe();
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

  if (event.type === "charge.dispute.created") {
    await handleDisputeCreated(event.data.object as Stripe.Dispute);
  }

  if (event.type === "charge.dispute.closed") {
    await handleDisputeClosed(event.data.object as Stripe.Dispute);
  }

  if (event.type === "account.updated") {
    await handleConnectAccountUpdated(event.data.object as Stripe.Account);
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
    include: { campaign: { include: { animal: true, conservancy: true } } },
  });

  if (!artwork) {
    return;
  }

  const shipping = session.collected_information?.shipping_details ?? session.customer_details;
  const address = shipping?.address;
  const customerId = session.metadata?.customerId;

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        artworkId: artwork.id,
        customerId: customerId || null,
        buyerEmail: session.customer_details?.email ?? session.customer_email ?? "unknown@buyer",
        shippingName: shipping?.name ?? "Unknown",
        shippingAddressLine1: address?.line1 ?? "",
        shippingAddressLine2: address?.line2 ?? null,
        shippingCity: address?.city ?? "",
        shippingRegion: address?.state ?? "",
        shippingPostalCode: address?.postal_code ?? "",
        shippingCountry: address?.country ?? "",
        // Deliberately the artwork's own price, not session.amount_total —
        // that Stripe field now includes the flat shipping fee too (see
        // PRINT_SHIPPING_CENTS in checkout/route.ts), and shipping revenue
        // must never flow into the artist/conservancy/ops split below.
        amountCents: artwork.priceCents,
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
        { orderId: order.id, recipientType: "CONSERVANCY", recipientId: getCampaignConservancyId(artwork.campaign), amountCents: split.conservancyCents },
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
  // Stripe retries webhook delivery, and a dashboard refund and an in-app
  // admin refund can race — either way, an already-REFUNDED order is a
  // no-op, not a duplicate.
  if (!order || order.status === "REFUNDED") {
    return;
  }

  await processRefund(order.id);
}

// A chargeback: the buyer disputed the charge with their bank instead of
// asking us for a refund. Unlike a refund, this is not something the buyer
// or an admin initiated in this app — it must be caught here or a payout
// could release on a transaction that's actively being clawed back by the
// card network. Stripe gives a strict deadline to submit evidence, so this
// needs a human immediately; no automatic resolution is attempted.
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!paymentIntentId) {
    return;
  }

  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
    include: { artwork: true },
  });
  if (!order) {
    return;
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { disputedAt: new Date() } }),
    // Same rule as a refund: only claw back payouts still PENDING. Anything
    // already RELEASED needs manual reconciliation if this dispute is lost.
    prisma.payout.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "FAILED" },
    }),
  ]);

  await sendOperationsAlert(
    `URGENT — chargeback opened: ${order.artwork.title}`,
    `<p>A dispute was opened on the charge for <strong>${order.artwork.title}</strong> ($${(order.amountCents / 100).toFixed(2)}, buyer ${order.buyerEmail}).</p>` +
      `<p>Stripe requires evidence to be submitted by a deadline — respond from the <a href="https://dashboard.stripe.com/disputes">Stripe dashboard</a> as soon as possible.</p>` +
      `<p>Any pending payout on this order has been held. If this dispute is later won, payouts for this order will need to be released manually from /admin/orders — this is not automatic.</p>`,
  );
}

async function handleDisputeClosed(dispute: Stripe.Dispute) {
  const paymentIntentId = typeof dispute.payment_intent === "string" ? dispute.payment_intent : dispute.payment_intent?.id;
  if (!paymentIntentId) {
    return;
  }

  const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, include: { artwork: true } });
  if (!order || !order.disputedAt) {
    return;
  }

  if (dispute.status === "lost") {
    // Lost means the money is gone, same as a refund — reuse the same
    // shared side effects (fail pending payouts, restore a SOLD original).
    await processRefund(order.id);
    return;
  }

  // Won (or any other closed outcome) — clear the dispute flag. Payouts
  // already FAILED by handleDisputeCreated are not auto-revived: without a
  // marker distinguishing "failed by this dispute" from "failed by an
  // unrelated refund," reviving them safely needs a human, per the warning
  // already sent when the dispute opened.
  await prisma.order.update({ where: { id: order.id }, data: { disputedAt: null } });
  await sendOperationsAlert(
    `Chargeback resolved in our favor: ${order.artwork.title}`,
    `<p>The dispute on <strong>${order.artwork.title}</strong> was closed as "${dispute.status}." If any payout on this order was held, check /admin/orders and release it manually — this was not automatic.</p>`,
  );
}

// The reliable long-term source of truth for a Connect account's status —
// /api/seller/connect/return and /api/cause/connect/return only catch the
// "came right back" case; this also catches an artist or cause finishing
// onboarding later via an emailed link, or Stripe later disabling payouts
// on the account for a compliance reason. An account belongs to at most
// one of Artist/Conservancy, so check both.
async function handleConnectAccountUpdated(account: Stripe.Account) {
  const artist = await prisma.artist.findFirst({ where: { stripeConnectedAccountId: account.id } });
  if (artist) {
    await prisma.artist.update({
      where: { id: artist.id },
      data: { stripeConnectOnboarded: Boolean(account.payouts_enabled) },
    });
    return;
  }

  const conservancy = await prisma.conservancy.findFirst({ where: { stripeConnectedAccountId: account.id } });
  if (conservancy) {
    await prisma.conservancy.update({
      where: { id: conservancy.id },
      data: { stripeConnectOnboarded: Boolean(account.payouts_enabled) },
    });
  }
}
