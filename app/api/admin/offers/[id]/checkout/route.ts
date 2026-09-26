import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiContractError } from "@/lib/api-contract";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const offer = await prisma.offer.findUnique({ where: { id }, include: { artwork: true, order: true } });
  if (!offer || !offer.order) return apiContractError("NOT_FOUND", "Winning offer payment is not ready", 404);
  if (offer.status !== "WINNING" || offer.order.status !== "AWAITING_PAYMENT") return apiContractError("CONFLICT", "Offer is not awaiting payment", 409);
  if (offer.expiresAt && offer.expiresAt < new Date()) return apiContractError("CONFLICT", "Payment window has expired", 409);
  let stripe;
  try { stripe = await getStripe(); } catch { return apiContractError("SERVICE_UNAVAILABLE", "Stripe isn't configured yet", 503); }
  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: offer.bidderEmail,
    line_items: [{ quantity: 1, price_data: { currency: offer.currency, unit_amount: offer.amountCents, product_data: { name: offer.artwork.title } } }],
    shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "KE"] },
    metadata: { artworkId: offer.artworkId, orderId: offer.order.id, offerId: offer.id },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled`,
  });
  await prisma.auditLog.create({ data: {
    action: "OFFER_PAYMENT_LINK_CREATED",
    affectedEntityType: "Order",
    affectedEntityId: offer.order.id,
    reason: "Operations administrator generated the winning offer payment link",
    changedBy: user!.email,
    metadata: { offerId: offer.id, stripeCheckoutSessionId: session.id, amountCents: offer.amountCents },
  } });
  return NextResponse.json({ url: session.url });
}
