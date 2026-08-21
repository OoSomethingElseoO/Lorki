import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { releaseExpiredReservations } from "@/lib/reservations";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { getCurrentCustomer } from "@/lib/customer-auth";

type CheckoutBody = {
  artworkId: string;
  buyerEmail?: string;
};

// Caps how often one IP can start a checkout, full stop — this is what stops
// someone from repeatedly RESERVEing (and thus hiding) a one-of-one original
// without ever paying, since each reservation locks it for 30 minutes.
const CHECKOUT_RATE_LIMIT = 5;
const CHECKOUT_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`checkout:${ip}`, CHECKOUT_RATE_LIMIT, CHECKOUT_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<CheckoutBody>;

  if (!body.artworkId) {
    return NextResponse.json({ error: "artworkId is required" }, { status: 400 });
  }

  // A logged-in buyer's email comes from their account, not the request
  // body — this is also what links the resulting Order back to them via
  // the webhook. Guests must supply an email explicitly.
  const customer = await getCurrentCustomer();
  const buyerEmail = customer?.email ?? body.buyerEmail;

  if (!buyerEmail) {
    return NextResponse.json({ error: "buyerEmail is required" }, { status: 400 });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return NextResponse.json({ error: "Checkout isn't configured yet — no Stripe key is set" }, { status: 503 });
  }

  await releaseExpiredReservations();

  const artwork = await prisma.artwork.findUnique({ where: { id: body.artworkId } });

  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  if (artwork.inventoryState !== "AVAILABLE") {
    return NextResponse.json({ error: "Artwork is not available" }, { status: 409 });
  }

  // Reserve originals immediately so two buyers can't check out the same
  // one-of-one piece at once. Prints have no inventory limit, so no reserve.
  if (artwork.kind === "ORIGINAL") {
    await prisma.artwork.update({
      where: { id: artwork.id },
      data: { inventoryState: "RESERVED", reservedAt: new Date() },
    });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: buyerEmail,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: artwork.currency,
            unit_amount: artwork.priceCents,
            product_data: { name: artwork.title },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "KE"] },
      metadata: { artworkId: artwork.id, ...(customer ? { customerId: customer.id } : {}) },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    // Undo the reservation on failure — otherwise a bad/expired Stripe key
    // or a transient API error locks the piece as RESERVED for the full
    // 30-minute TTL even though no checkout session was ever created.
    if (artwork.kind === "ORIGINAL") {
      await prisma.artwork.update({
        where: { id: artwork.id },
        data: { inventoryState: "AVAILABLE", reservedAt: null },
      });
    }
    console.error("[checkout] Stripe session creation failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
