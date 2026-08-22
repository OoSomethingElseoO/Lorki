import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { PRINT_SHIPPING_CENTS } from "@/lib/pricing";

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
  const customer = await getCurrentUser();
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

  const artwork = await prisma.artwork.findUnique({ where: { id: body.artworkId } });

  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  if (artwork.inventoryState !== "AVAILABLE") {
    return NextResponse.json({ error: "Artwork is not available" }, { status: 409 });
  }

  // Originals are one-of-one and high-value — they're arranged personally
  // (see /api/inquiries), never sold through instant self-checkout. Blocking
  // it here too (not just in the UI) matters: without this, anyone who knew
  // an artworkId could hit this endpoint directly and buy a one-of-one
  // instantly, bypassing the entire point of the inquiry flow.
  if (artwork.kind === "ORIGINAL") {
    return NextResponse.json(
      { error: "Originals are arranged personally rather than sold through instant checkout — please submit an inquiry instead." },
      { status: 409 },
    );
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
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: PRINT_SHIPPING_CENTS, currency: artwork.currency },
            display_name: "Standard shipping",
          },
        },
      ],
      metadata: { artworkId: artwork.id, ...(customer ? { customerId: customer.id } : {}) },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[checkout] Stripe session creation failed", error);
    return NextResponse.json({ error: "Checkout is temporarily unavailable. Please try again." }, { status: 502 });
  }
}
