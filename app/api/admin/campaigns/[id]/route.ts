import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;

type UpdateBody = {
  animalId?: string | null;
  conservancyId?: string | null;
  artistId?: string;
  artistPercent?: number;
  conservancyPercent?: number;
  operationsPercent?: number;
  status?: string;
};

// Handles both the status-only PATCH used by CampaignStatusControl (sends
// only { status }) and the fuller edit form (always sends both animalId
// and conservancyId — one a real id, one explicitly null — since a
// campaign links exactly one of the two, see the schema comment on
// Campaign). Distinguishing "field omitted" from "field explicitly null"
// matters here: the status-only PATCH must never accidentally clear
// whichever cause reference the campaign already has. Slug is never
// touched on edit, same immutable-identifier rule as Animal/Artist.
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as UpdateBody;

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const causeFieldsPresent = body.animalId !== undefined || body.conservancyId !== undefined;
  const nextAnimalId = causeFieldsPresent ? body.animalId ?? null : campaign.animalId;
  const nextConservancyId = causeFieldsPresent ? body.conservancyId ?? null : campaign.conservancyId;
  const nextArtistId = body.artistId ?? campaign.artistId;
  const nextArtistPercent = body.artistPercent ?? campaign.artistPercent;
  const nextConservancyPercent = body.conservancyPercent ?? campaign.conservancyPercent;
  const nextOperationsPercent = body.operationsPercent ?? campaign.operationsPercent;

  if (causeFieldsPresent && Boolean(nextAnimalId) === Boolean(nextConservancyId)) {
    return NextResponse.json({ error: "Provide exactly one of animalId or conservancyId" }, { status: 400 });
  }

  if (nextArtistPercent + nextConservancyPercent + nextOperationsPercent !== 100) {
    return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 });
  }

  if (nextAnimalId) {
    const animal = await prisma.animal.findUnique({ where: { id: nextAnimalId } });
    if (!animal) {
      return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
    }
  }

  if (nextConservancyId) {
    const conservancy = await prisma.conservancy.findUnique({ where: { id: nextConservancyId } });
    if (!conservancy) {
      return NextResponse.json({ error: "conservancyId does not match an existing conservancy" }, { status: 400 });
    }
  }

  if (body.artistId !== undefined) {
    const artist = await prisma.artist.findUnique({ where: { id: body.artistId } });
    if (!artist) {
      return NextResponse.json({ error: "artistId does not match an existing artist" }, { status: 400 });
    }
  }

  try {
    const updated = await prisma.campaign.update({
      where: { id },
      data: {
        animalId: nextAnimalId,
        conservancyId: nextConservancyId,
        artistId: nextArtistId,
        artistPercent: nextArtistPercent,
        conservancyPercent: nextConservancyPercent,
        operationsPercent: nextOperationsPercent,
        ...(body.status !== undefined ? { status: body.status as (typeof VALID_STATUSES)[number] } : {}),
      },
    });

    return NextResponse.json({ campaign: updated });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.campaign.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This campaign still has artworks under it — remove those first");
    }
    throw error;
  }
}
