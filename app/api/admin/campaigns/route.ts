import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    include: {
      animal: { include: { conservancy: true } },
      artist: true,
      artworks: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ campaigns });
}

type CreateBody = {
  animalId: string;
  artistId: string;
  artistPercent: number;
  conservancyPercent: number;
  operationsPercent: number;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

  if (
    !body.animalId ||
    !body.artistId ||
    typeof body.artistPercent !== "number" ||
    typeof body.conservancyPercent !== "number" ||
    typeof body.operationsPercent !== "number"
  ) {
    return NextResponse.json(
      { error: "animalId, artistId, artistPercent, conservancyPercent, and operationsPercent are required" },
      { status: 400 },
    );
  }

  if (body.artistPercent + body.conservancyPercent + body.operationsPercent !== 100) {
    return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 });
  }

  const [animal, artist] = await Promise.all([
    prisma.animal.findUnique({ where: { id: body.animalId } }),
    prisma.artist.findUnique({ where: { id: body.artistId } }),
  ]);

  if (!animal) {
    return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
  }
  if (!artist) {
    return NextResponse.json({ error: "artistId does not match an existing artist" }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        slug: `${animal.slug}-${artist.slug}`,
        animalId: body.animalId,
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
      return uniqueConstraintResponse("A campaign for this animal and artist already exists");
    }
    throw error;
  }
}
