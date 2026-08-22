import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSeller } from "@/lib/seller-auth";
import { DEFAULT_SPLIT } from "@/lib/payouts";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: seller.id },
    include: { animal: { include: { conservancy: true } }, artworks: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

type CreateBody = { animalId: string };

// Full self-service: picks any existing (admin-vetted) animal, published
// LIVE immediately — no admin approval step. The split ratio is fixed
// (DEFAULT_SPLIT), never settable here; see lib/payouts.ts for why.
export async function POST(request: Request) {
  const seller = await getCurrentSeller();
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.animalId) {
    return NextResponse.json({ error: "animalId is required" }, { status: 400 });
  }

  const animal = await prisma.animal.findUnique({ where: { id: body.animalId } });
  if (!animal) {
    return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.create({
      data: {
        slug: `${animal.slug}-${seller.slug}`,
        animalId: animal.id,
        artistId: seller.id,
        ...DEFAULT_SPLIT,
        status: "LIVE",
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("You already have a campaign for this animal");
    }
    throw error;
  }
}
