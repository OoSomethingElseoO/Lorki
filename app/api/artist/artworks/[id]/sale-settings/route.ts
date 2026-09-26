import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { parseSaleSettings } from "@/lib/sale-settings";
import { recordAudit } from "@/lib/audit";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { artistRequired, loadArtistArtwork } from "@/lib/authorization";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) return apiContractError("UNAUTHORIZED", "Not signed in as an artist", 401);
  const { id } = await params;
  const body = await readJsonObject(request);
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);
  const artwork = await loadArtistArtwork(artist.id, id);
  if (!artwork) return apiContractError("NOT_FOUND", "Artwork not found", 404);
  if (artwork.kind !== "ORIGINAL") return apiContractError("VALIDATION_ERROR", "Offers are currently available for originals only", 400);
  if (artwork.inventoryState === "SOLD") return apiContractError("CONFLICT", "Sold artwork cannot change sale settings", 409);
  try {
    const settings = parseSaleSettings(body);
    if (settings.saleMode === "AUCTION" && !isFeatureEnabled("AUCTIONS")) {
      return apiContractError("SERVICE_UNAVAILABLE", "Auctions are not enabled yet", 503);
    }
    const updated = await prisma.artwork.update({ where: { id }, data: settings, select: { id: true, saleMode: true, offerClosesAt: true } });
    await recordAudit({ action: "ARTIST_ARTWORK_SALE_SETTINGS_UPDATED", affectedEntityType: "Artwork", affectedEntityId: id, reason: "Artist changed artwork sale settings", changedBy: currentUser!.email, metadata: updated });
    return NextResponse.json({ artwork: updated });
  } catch (error) {
    return apiContractError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid sale settings", 400);
  }
}
