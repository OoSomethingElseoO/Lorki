import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string; artworkId: string }> };

type UpdateBody = {
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id, artworkId } = await params;
  const body = await readJsonObject(request) as Partial<UpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return apiContractError("VALIDATION_ERROR", "title, kind, priceCents, imageUrl, and altText are required", 400);
  }

  if (body.kind !== "ORIGINAL" && body.kind !== "PRINT") {
    return apiContractError("VALIDATION_ERROR", "kind must be ORIGINAL or PRINT", 400);
  }

  if (isPriceTooLow(body.priceCents)) {
    return apiContractError("VALIDATION_ERROR", `priceCents must be at least ${MIN_PRICE_CENTS}`, 400);
  }

  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (!artwork || artwork.campaignId !== id) {
    return apiContractError("NOT_FOUND", "Artwork not found on this campaign", 404);
  }
  if (artwork.currentHighestOfferAmountCents !== null && body.priceCents < artwork.currentHighestOfferAmountCents) {
    return apiContractError("CONFLICT", "Price cannot be below the current highest valid offer", 409);
  }

  try {
    const updated = await prisma.artwork.update({
      where: { id: artworkId },
      data: {
        title: body.title,
        kind: body.kind,
        priceCents: body.priceCents,
        imageUrl: body.imageUrl,
        altText: body.altText,
        story: body.story || null,
      },
    });

    await recordAudit({ action: "ARTWORK_UPDATED", affectedEntityType: "Artwork", affectedEntityId: updated.id, reason: "Operations administrator updated campaign artwork", changedBy: user!.email, metadata: { campaignId: id, title: updated.title, kind: updated.kind, priceCents: updated.priceCents } });

    return NextResponse.json({ artwork: updated });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Artwork not found", 404);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id, artworkId } = await params;

  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (!artwork || artwork.campaignId !== id) {
    return apiContractError("NOT_FOUND", "Artwork not found on this campaign", 404);
  }

  try {
    const artwork = await prisma.artwork.delete({ where: { id: artworkId } });
    await recordAudit({ action: "ARTWORK_DELETED", affectedEntityType: "Artwork", affectedEntityId: artworkId, reason: "Operations administrator deleted campaign artwork", changedBy: user!.email, metadata: { campaignId: id, title: artwork.title, kind: artwork.kind } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Artwork not found", 404);
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This artwork already has orders against it and can't be deleted");
    }
    throw error;
  }
}
