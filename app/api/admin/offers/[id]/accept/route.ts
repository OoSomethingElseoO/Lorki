import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const offer = await tx.offer.findUnique({ where: { id }, include: { artwork: true } });
      if (!offer) throw new Error("NOT_FOUND");
      const locked = await tx.$queryRaw<Array<{ inventoryState: string; saleMode: string; offerClosesAt: Date | null; currentHighestOfferId: string | null }>>`SELECT "inventoryState", "saleMode", "offerClosesAt", "currentHighestOfferId" FROM "Artwork" WHERE "id" = ${offer.artworkId} FOR UPDATE`;
      const artwork = locked[0];
      if (!artwork || artwork.inventoryState === "SOLD" || artwork.inventoryState === "RESERVED") throw new Error("NOT_AVAILABLE");
      if (offer.status !== "SUBMITTED") throw new Error("OFFER_NOT_OPEN");
      // The page may have been open while a higher offer arrived. Never
      // silently decline that newer offer because an admin clicked a stale row.
      if (artwork.currentHighestOfferId !== offer.id) throw new Error("STALE_WINNER");
      if (artwork.saleMode === "AUCTION" && (!artwork.offerClosesAt || artwork.offerClosesAt.getTime() > Date.now())) throw new Error("AUCTION_OPEN");

      const order = await tx.order.create({
        data: {
          artworkId: offer.artworkId,
          offerId: offer.id,
          customerId: offer.bidderId,
          buyerEmail: offer.bidderEmail,
          shippingName: "",
          shippingAddressLine1: "",
          shippingCity: "",
          shippingRegion: "",
          shippingPostalCode: "",
          shippingCountry: "",
          amountCents: offer.amountCents,
          currency: offer.currency,
          status: "AWAITING_PAYMENT",
          reviewedAt: new Date(),
          reviewedBy: user!.email,
          reviewNote: "Offer accepted by operations administrator",
        },
      });
      await tx.offer.update({ where: { id: offer.id }, data: { status: "WINNING", expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
      await tx.offer.updateMany({ where: { artworkId: offer.artworkId, id: { not: offer.id }, status: "SUBMITTED" }, data: { status: "DECLINED" } });
      await tx.artwork.update({ where: { id: offer.artworkId }, data: { inventoryState: "RESERVED", reservedAt: new Date() } });
      return order;
    });
    await prisma.auditLog.create({ data: {
      action: "OFFER_ACCEPTED",
      affectedEntityType: "Order",
      affectedEntityId: result.id,
      reason: "Operations administrator selected the highest valid offer",
      changedBy: user!.email,
      metadata: { offerId: id, amountCents: result.amountCents, artworkId: result.artworkId },
    } });
    return NextResponse.json({ order: result });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    if (code === "AUCTION_OPEN") return NextResponse.json({ error: "Auction is still open" }, { status: 409 });
    if (code === "OFFER_NOT_OPEN") return NextResponse.json({ error: "Offer is no longer open" }, { status: 409 });
    if (code === "STALE_WINNER") return NextResponse.json({ error: "A newer or higher offer exists; refresh before selecting a winner" }, { status: 409 });
    if (code === "NOT_AVAILABLE") return NextResponse.json({ error: "Artwork is no longer available" }, { status: 409 });
    throw error;
  }
}
