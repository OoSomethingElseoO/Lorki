import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attemptAutomaticPayout } from "@/lib/payout-channels";

type RouteParams = { params: Promise<{ id: string }> };

// This is what actually releases the held payout — not shipping. The buyer
// needs to have the piece in hand before money moves to the
// artist/conservancy/ops, since a lost-in-transit or damaged delivery still
// needs to be refundable with nothing to unwind on the recipient's side.
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      shipment: true,
      payouts: true,
      artwork: {
        include: {
          campaign: {
            include: {
              artist: true,
              conservancy: true,
              animal: { include: { conservancy: true } },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "SHIPPED" || !order.shipment) {
    return NextResponse.json(
      { error: `Cannot mark delivered — order must be SHIPPED with a shipment on file (currently ${order.status})` },
      { status: 409 },
    );
  }

  const pendingArtistPayoutId = order.payouts.find((p) => p.recipientType === "ARTIST" && p.status === "PENDING")?.id;
  const pendingConservancyPayoutId = order.payouts.find((p) => p.recipientType === "CONSERVANCY" && p.status === "PENDING")?.id;
  const conservancy = order.artwork.campaign.animal?.conservancy ?? order.artwork.campaign.conservancy;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.shipment.update({ where: { orderId: order.id }, data: { deliveredAt: new Date() } });
    const updatedOrder = await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await tx.payout.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
    return updatedOrder;
  });

  // Best-effort, after the transaction commits — a failed automatic
  // transfer attempt must never roll back the delivery/payout-release
  // itself, only fall back to a manual obligation (see attemptAutomaticPayout).
  if (pendingArtistPayoutId) {
    await attemptAutomaticPayout(pendingArtistPayoutId, order.artwork.campaign.artist);
  }
  if (pendingConservancyPayoutId && conservancy) {
    await attemptAutomaticPayout(pendingConservancyPayoutId, conservancy);
  }

  return NextResponse.json({ order: updated });
}
