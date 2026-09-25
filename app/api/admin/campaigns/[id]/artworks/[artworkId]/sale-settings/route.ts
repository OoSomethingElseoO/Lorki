import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { parseSaleSettings } from "@/lib/sale-settings";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; artworkId: string }> }) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id, artworkId } = await params;
  const artwork = await prisma.artwork.findFirst({ where: { id: artworkId, campaignId: id }, select: { id: true, kind: true, inventoryState: true } });
  if (!artwork) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  if (artwork.kind !== "ORIGINAL") return NextResponse.json({ error: "Offers are currently available for originals only" }, { status: 400 });
  if (artwork.inventoryState === "SOLD") return NextResponse.json({ error: "Sold artwork cannot change sale settings" }, { status: 409 });
  try {
    const settings = parseSaleSettings(await request.json());
    const updated = await prisma.artwork.update({ where: { id: artworkId }, data: settings, select: { id: true, saleMode: true, offerClosesAt: true } });
    await recordAudit({ action: "ARTWORK_SALE_SETTINGS_UPDATED", affectedEntityType: "Artwork", affectedEntityId: artworkId, reason: "Operations administrator changed sale mode", changedBy: user!.email, metadata: updated });
    return NextResponse.json({ artwork: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid sale settings" }, { status: 400 });
  }
}
