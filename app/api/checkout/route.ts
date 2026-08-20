import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { releaseExpiredReservations } from "@/lib/reservations";

type CheckoutBody = {
  artworkId: string;
  buyerEmail: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CheckoutBody>;

  if (!body.artworkId || !body.buyerEmail) {
    return NextResponse.json({ error: "artworkId and buyerEmail are required" }, { status: 400 });
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

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: body.buyerEmail,
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
    metadata: { artworkId: artwork.id },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
