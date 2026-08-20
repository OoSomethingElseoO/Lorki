import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;

type UpdateBody = {
  animalId?: string;
  artistId?: string;
  artistPercent?: number;
  conservancyPercent?: number;
  operationsPercent?: number;
  status?: string;
};

// Handles both the status-only PATCH used by CampaignStatusControl and the
// fuller edit form — every field is optional, and whichever are present get
// updated. Slug is never touched on edit, same immutable-identifier rule as
// Animal/Artist.
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

  const nextAnimalId = body.animalId ?? campaign.animalId;
  const nextArtistId = body.artistId ?? campaign.artistId;
  const nextArtistPercent = body.artistPercent ?? campaign.artistPercent;
  const nextConservancyPercent = body.conservancyPercent ?? campaign.conservancyPercent;
  const nextOperationsPercent = body.operationsPercent ?? campaign.operationsPercent;

  if (nextArtistPercent + nextConservancyPercent + nextOperationsPercent !== 100) {
    return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 });
  }

  if (body.animalId !== undefined) {
    const animal = await prisma.animal.findUnique({ where: { id: body.animalId } });
    if (!animal) {
      return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
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
