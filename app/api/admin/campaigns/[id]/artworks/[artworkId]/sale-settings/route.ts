import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { parseSaleSettings } from "@/lib/sale-settings";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; artworkId: string }> }) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id, artworkId } = await params;
  const artwork = await prisma.artwork.findFirst({ where: { id: artworkId, campaignId: id }, select: { id: true, kind: true, inventoryState: true } });
  if (!artwork) return apiContractError("NOT_FOUND", "Artwork not found", 404);
  if (artwork.kind !== "ORIGINAL") return apiContractError("VALIDATION_ERROR", "Offers are currently available for originals only", 400);
  if (artwork.inventoryState === "SOLD") return apiContractError("CONFLICT", "Sold artwork cannot change sale settings", 409);
  try {
    const body = await readJsonObject(request);
    if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);
    const settings = parseSaleSettings(body);
    const updated = await prisma.artwork.update({ where: { id: artworkId }, data: settings, select: { id: true, saleMode: true, offerClosesAt: true } });
    await recordAudit({ action: "ARTWORK_SALE_SETTINGS_UPDATED", affectedEntityType: "Artwork", affectedEntityId: artworkId, reason: "Operations administrator changed sale mode", changedBy: user!.email, metadata: updated });
    return NextResponse.json({ artwork: updated });
  } catch (error) {
    return apiContractError("VALIDATION_ERROR", error instanceof Error ? error.message : "Invalid sale settings", 400);
  }
}
