import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeSplit, getCampaignConservancyId } from "@/lib/payouts";
import { sendOperationsAlert, sendOrderConfirmationEmail } from "@/lib/email";
import { attemptAutomaticPayout } from "@/lib/payout-channels";

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
  // Buyer is taking the piece home right now — nothing to ship, so there's
  // no delivery window to wait out. Payouts release immediately instead of
  // holding PENDING through the normal ship-then-deliver flow.
  inPerson?: boolean;
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
    include: {
      campaign: {
        include: { artist: true, conservancy: true, animal: { include: { conservancy: true } } },
      },
    },
  });

  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  // RESERVED is expected and fine here, not a block — it's exactly the
  // state an original ends up in the moment someone submits an inquiry
  // (see /api/inquiries), and recording the resulting cash sale is how
  // that reservation is meant to resolve. Only an already-SOLD piece
  // should actually refuse a second sale.
  if (artwork.inventoryState === "SOLD") {
    return NextResponse.json({ error: "Artwork is not available" }, { status: 409 });
  }

  const inPerson = body.inPerson === true;
  const conservancyId = getCampaignConservancyId(artwork.campaign);
  const conservancy = artwork.campaign.animal?.conservancy ?? artwork.campaign.conservancy!;

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
        // In-person handoffs skip the ship→deliver wait entirely: the buyer
        // already has the piece the moment the sale is recorded.
        status: inPerson ? "DELIVERED" : "PAID",
      },
    });

    if (artwork.kind === "ORIGINAL") {
      await tx.artwork.update({
        where: { id: artwork.id },
        data: { inventoryState: "SOLD", reservedAt: null },
      });
    }

    const split = computeSplit(order.amountCents, artwork.campaign);
    const payoutStatus = inPerson ? ("RELEASED" as const) : ("PENDING" as const);
    const releasedAt = inPerson ? new Date() : null;

    await tx.payout.createMany({
      data: [
        {
          orderId: order.id,
          recipientType: "ARTIST",
          recipientId: artwork.campaign.artistId,
          amountCents: split.artistCents,
          status: payoutStatus,
          releasedAt,
        },
        {
          orderId: order.id,
          recipientType: "CONSERVANCY",
          recipientId: conservancyId,
          amountCents: split.conservancyCents,
          status: payoutStatus,
          releasedAt,
        },
        {
          orderId: order.id,
          recipientType: "OPERATIONS",
          recipientId: "operations",
          amountCents: split.operationsCents,
          status: payoutStatus,
          releasedAt,
        },
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

  if (inPerson) {
    const artistPayout = await prisma.payout.findFirst({ where: { orderId: order.id, recipientType: "ARTIST" } });
    if (artistPayout) {
      await attemptAutomaticPayout(artistPayout.id, artwork.campaign.artist);
    }
    const conservancyPayout = await prisma.payout.findFirst({ where: { orderId: order.id, recipientType: "CONSERVANCY" } });
    if (conservancyPayout) {
      await attemptAutomaticPayout(conservancyPayout.id, conservancy);
    }
  }

  return NextResponse.json({ order }, { status: 201 });
}
