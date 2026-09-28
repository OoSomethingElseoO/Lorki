import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError } from "@/lib/prisma-errors";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";
import { recordAudit } from "@/lib/audit";
import { loadArtistArtwork, artistRequired } from "@/lib/authorization";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const { id } = await params;
  const owned = await loadArtistArtwork(artist.id, id);
  if (!owned) {
    return apiContractError("NOT_FOUND", "Artwork not found", 404);
  }

  const body = await readJsonObject(request) as Partial<UpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return apiContractError("VALIDATION_ERROR", "title, kind, priceCents, imageUrl, and altText are required", 400);
  }

  if (owned.inventoryState === "SOLD") {
    return apiContractError("CONFLICT", "This piece has already sold and can no longer be edited", 409);
  }

  if (isPriceTooLow(body.priceCents)) {
    return apiContractError("VALIDATION_ERROR", `priceCents must be at least ${MIN_PRICE_CENTS}`, 400);
  }
  if (owned.currentHighestOfferAmountCents !== null && body.priceCents < owned.currentHighestOfferAmountCents) {
    return apiContractError("CONFLICT", "Price cannot be below the current highest valid offer", 409);
  }

  const artwork = await prisma.artwork.update({
    where: { id },
    data: {
      title: body.title,
      kind: body.kind,
      priceCents: body.priceCents,
      imageUrl: body.imageUrl,
      altText: body.altText,
      story: body.story || null,
      isPublished: false,
    },
  });
  await recordAudit({ action: "ARTIST_ARTWORK_UPDATED", affectedEntityType: "Artwork", affectedEntityId: id, reason: "Artist updated artwork", changedBy: currentUser!.email, metadata: { fields: ["title", "kind", "priceCents", "imageUrl", "altText", "story"] } });

  return NextResponse.json({ artwork });
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const { id } = await params;
  const owned = await loadArtistArtwork(artist.id, id);
  if (!owned) {
    return apiContractError("NOT_FOUND", "Artwork not found", 404);
  }

  if (owned.inventoryState === "SOLD") {
    return apiContractError("CONFLICT", "This piece has already sold and can no longer be removed", 409);
  }

  try {
    await prisma.artwork.delete({ where: { id } });
    await recordAudit({ action: "ARTIST_ARTWORK_DELETED", affectedEntityType: "Artwork", affectedEntityId: id, reason: "Artist deleted unsold artwork", changedBy: currentUser!.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This piece already has orders against it and can't be deleted");
    }
    throw error;
  }
}
