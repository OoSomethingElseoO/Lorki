import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { slugify } from "@/lib/slugify";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      animal: { include: { conservancy: true } },
      conservancy: true,
      artist: true,
      artworks: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

type CreateBody = {
  animalId: string | null;
  conservancyId: string | null;
  artistId: string;
  artistPercent: number;
  conservancyPercent: number;
  operationsPercent: number;
};

// A campaign links exactly one of animalId (a specific animal — the
// conservancy is derived from it) or conservancyId (a cause picked
// directly, no animal) — never both, never neither. See the schema
// comment on Campaign and lib/campaigns.ts/lib/payouts.ts, which resolve
// this same either/or for display and payout purposes respectively.
export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

  if (
    !body.artistId ||
    typeof body.artistPercent !== "number" ||
    typeof body.conservancyPercent !== "number" ||
    typeof body.operationsPercent !== "number"
  ) {
    return NextResponse.json(
      { error: "artistId, artistPercent, conservancyPercent, and operationsPercent are required" },
      { status: 400 },
    );
  }

  if (Boolean(body.animalId) === Boolean(body.conservancyId)) {
    return NextResponse.json({ error: "Provide exactly one of animalId or conservancyId" }, { status: 400 });
  }

  if (body.artistPercent + body.conservancyPercent + body.operationsPercent !== 100) {
    return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 });
  }

  const [animal, conservancy, artist] = await Promise.all([
    body.animalId ? prisma.animal.findUnique({ where: { id: body.animalId } }) : null,
    body.conservancyId ? prisma.conservancy.findUnique({ where: { id: body.conservancyId } }) : null,
    prisma.artist.findUnique({ where: { id: body.artistId } }),
  ]);

  if (body.animalId && !animal) {
    return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
  }
  if (body.conservancyId && !conservancy) {
    return NextResponse.json({ error: "conservancyId does not match an existing conservancy" }, { status: 400 });
  }
  if (!artist) {
    return NextResponse.json({ error: "artistId does not match an existing artist" }, { status: 400 });
  }

  const causeSlug = animal ? animal.slug : slugify(conservancy!.name);

  try {
    const campaign = await prisma.campaign.create({
      data: {
        slug: `${causeSlug}-${artist.slug}`,
        animalId: body.animalId || null,
        conservancyId: body.conservancyId || null,
        artistId: body.artistId,
        artistPercent: body.artistPercent,
        conservancyPercent: body.conservancyPercent,
        operationsPercent: body.operationsPercent,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("A campaign for this cause and artist already exists");
    }
    throw error;
  }
}
