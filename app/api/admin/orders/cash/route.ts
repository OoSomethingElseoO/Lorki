import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSplit } from "@/lib/payouts";
import { sendOperationsAlert, sendOrderConfirmationEmail } from "@/lib/email";

type CashSaleBody = {
  artworkId: string;
  buyerEmail: string;
  shippingName?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingRegion?: string;
  shippingPostalCode?: string;
  shippingCountry?: string;
};

// Mirrors handleCheckoutCompleted in app/api/webhooks/stripe/route.ts — same
// split computation, same inventory/payout side effects — the only
// difference is who's asserting the payment happened: Stripe's signature
// there, an authenticated admin here. Shipping fields are optional since a
// cash sale is often handed over in person with nothing to ship.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CashSaleBody>;

  if (!body.artworkId || !body.buyerEmail) {
    return NextResponse.json({ error: "artworkId and buyerEmail are required" }, { status: 400 });
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: body.artworkId },
    include: { campaign: true },
  });

  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  if (artwork.inventoryState !== "AVAILABLE") {
    return NextResponse.json({ error: "Artwork is not available" }, { status: 409 });
  }

  const order = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        artworkId: artwork.id,
        buyerEmail: body.buyerEmail!,
        shippingName: body.shippingName ?? "",
        shippingAddressLine1: body.shippingAddressLine1 ?? "",
        shippingAddressLine2: body.shippingAddressLine2 || null,
        shippingCity: body.shippingCity ?? "",
        shippingRegion: body.shippingRegion ?? "",
        shippingPostalCode: body.shippingPostalCode ?? "",
        shippingCountry: body.shippingCountry ?? "",
        amountCents: artwork.priceCents,
        currency: artwork.currency,
        paymentMethod: "CASH",
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
    `Cash sale recorded: ${artwork.title}`,
    `<p>${order.buyerEmail} bought <strong>${artwork.title}</strong> for $${(order.amountCents / 100).toFixed(2)} (cash).</p>`,
  );

  return NextResponse.json({ order }, { status: 201 });
}
