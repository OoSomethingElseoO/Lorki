import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseSaleSettings } from "@/lib/sale-settings";
import { recordAudit } from "@/lib/audit";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) return NextResponse.json({ error: "Not signed in as an artist" }, { status: 401 });
  const { id } = await params;
  const body = await request.json() as { saleMode?: unknown; offerClosesAt?: unknown };
  const artwork = await prisma.artwork.findFirst({ where: { id, campaign: { artistId: artist.id } }, select: { id: true, kind: true, inventoryState: true } });
  if (!artwork) return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  if (artwork.kind !== "ORIGINAL") return NextResponse.json({ error: "Offers are currently available for originals only" }, { status: 400 });
  if (artwork.inventoryState === "SOLD") return NextResponse.json({ error: "Sold artwork cannot change sale settings" }, { status: 409 });
  try {
    const settings = parseSaleSettings(body);
    const updated = await prisma.artwork.update({ where: { id }, data: settings, select: { id: true, saleMode: true, offerClosesAt: true } });
    await recordAudit({ action: "ARTIST_ARTWORK_SALE_SETTINGS_UPDATED", affectedEntityType: "Artwork", affectedEntityId: id, reason: "Artist changed artwork sale settings", changedBy: currentUser!.email, metadata: updated });
    return NextResponse.json({ artwork: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid sale settings" }, { status: 400 });
  }
}
