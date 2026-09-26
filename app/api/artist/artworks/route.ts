import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { artistRequired } from "@/lib/authorization";
import { isPriceTooLow, isPriceTooHigh, MIN_PRICE_CENTS, MAX_PRICE_CENTS } from "@/lib/pricing";
import { validateArtworkCreation } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { apiContractError, apiJson } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const artworks = await prisma.artwork.findMany({
    where: { campaign: { artistId: artist.id } },
    include: { campaign: { include: { animal: true } } },
    orderBy: { createdAt: "desc" },
  });

  return apiJson({ artworks });
}

type CreateBody = {
  campaignId: string;
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

// A self-service campaign is born DRAFT — pending review — not LIVE. An
// artist can still submit artwork into it while it's DRAFT (that's the
// whole point: submit, then we set the real price and publish). Only
// PAUSED/ARCHIVED, an admin's deliberate stop, blocks new submissions.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.campaignId || !body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return apiContractError("VALIDATION_ERROR", "campaignId, title, kind, priceCents, imageUrl, and altText are required", 400);
  }

  if (body.kind !== "ORIGINAL" && body.kind !== "PRINT") {
    return apiContractError("VALIDATION_ERROR", "kind must be ORIGINAL or PRINT", 400);
  }

  // ✅ Comprehensive validation
  const validation = validateArtworkCreation({
    title: body.title,
    priceDollars: body.priceCents / 100,
    altText: body.altText,
    imageUrl: body.imageUrl,
    story: body.story ?? undefined,
  });

  if (!validation.isValid) {
    return apiContractError("VALIDATION_ERROR", "Invalid artwork", 400, { errors: validation.errors });
  }

  // Ownership check: this campaign must actually belong to the artist
  // making the request — otherwise anyone could list artwork under
  // someone else's campaign.
  const campaign = await prisma.campaign.findUnique({ where: { id: body.campaignId } });
  if (!campaign || campaign.artistId !== artist.id) {
    return apiContractError("NOT_FOUND", "Campaign not found", 404);
  }

  // DRAFT (pending review) and LIVE both accept new submissions. Only a
  // deliberate admin stop — PAUSED or ARCHIVED — rejects here instead of
  // letting a listing get created that would then silently never appear
  // anywhere (every storefront query filters on campaign.status === "LIVE").
  if (campaign.status === "PAUSED" || campaign.status === "ARCHIVED") {
    return apiContractError("CONFLICT", `This campaign is ${campaign.status.toLowerCase()} — new listings aren't accepted right now.`, 409);
  }

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: body.title,
      kind: body.kind,
      priceCents: body.priceCents,
      imageUrl: body.imageUrl,
      altText: body.altText,
      story: body.story || null,
    },
  });
  await recordAudit({ action: "ARTIST_ARTWORK_CREATED", affectedEntityType: "Artwork", affectedEntityId: artwork.id, reason: "Artist submitted artwork", changedBy: currentUser!.email, metadata: { campaignId: campaign.id, kind: artwork.kind, priceCents: artwork.priceCents } });

  return NextResponse.json({ artwork }, { status: 201 });
}
