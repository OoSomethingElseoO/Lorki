import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiContractError } from "@/lib/api-contract";
import { sendOfferNotificationEmail } from "@/lib/email";
import { enforceHighRiskMfa } from "@/lib/mfa-policy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const mfaError = await enforceHighRiskMfa(request);
  if (mfaError) return mfaError;
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
      const declined = await tx.offer.findMany({ where: { artworkId: offer.artworkId, id: { not: offer.id }, status: "SUBMITTED" }, select: { bidderEmail: true } });
      await tx.offer.updateMany({ where: { artworkId: offer.artworkId, id: { not: offer.id }, status: "SUBMITTED" }, data: { status: "DECLINED" } });
      await tx.artwork.update({ where: { id: offer.artworkId }, data: { inventoryState: "RESERVED", reservedAt: new Date() } });
      return { order, winnerEmail: offer.bidderEmail, artworkTitle: offer.artwork.title, amount: `$${(offer.amountCents / 100).toFixed(2)}`, declinedEmails: declined.map((item) => item.bidderEmail) };
    });
    await prisma.auditLog.create({ data: {
      action: "OFFER_ACCEPTED",
      affectedEntityType: "Order",
      affectedEntityId: result.order.id,
      reason: "Operations administrator selected the highest valid offer",
      changedBy: user!.email,
      metadata: { offerId: id, amountCents: result.order.amountCents, artworkId: result.order.artworkId },
    } });
    sendOfferNotificationEmail(result.winnerEmail, result.artworkTitle, result.amount, "accepted").catch(() => undefined);
    for (const email of result.declinedEmails) sendOfferNotificationEmail(email, result.artworkTitle, result.amount, "declined").catch(() => undefined);
    return NextResponse.json({ order: result.order });
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return apiContractError("NOT_FOUND", "Offer not found", 404);
    if (code === "AUCTION_OPEN") return apiContractError("CONFLICT", "Auction is still open", 409);
    if (code === "OFFER_NOT_OPEN") return apiContractError("CONFLICT", "Offer is no longer open", 409);
    if (code === "STALE_WINNER") return apiContractError("CONFLICT", "A newer or higher offer exists; refresh before selecting a winner", 409);
    if (code === "NOT_AVAILABLE") return apiContractError("CONFLICT", "Artwork is no longer available", 409);
    throw error;
  }
}
