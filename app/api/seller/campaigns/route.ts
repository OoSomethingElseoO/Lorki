import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { DEFAULT_SPLIT } from "@/lib/payouts";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { slugify } from "@/lib/slugify";

export async function GET() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: seller.id },
    include: { animal: { include: { conservancy: true } }, conservancy: true, artworks: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ campaigns });
}

type CreateBody = { animalId?: string; conservancyId?: string };

// Full self-service: picks either an existing (admin-vetted) animal — the
// wildlife-portrait case this app started as — or, for anything else,
// picks a registered cause directly (no animal involved at all; see the
// schema comment on Campaign). Exactly one of the two, never both/neither.
// Published LIVE immediately — no admin approval step either way. The
// split ratio is fixed (DEFAULT_SPLIT), never settable here; see
// lib/payouts.ts for why.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<CreateBody>;

  if (Boolean(body.animalId) === Boolean(body.conservancyId)) {
    return NextResponse.json({ error: "Provide exactly one of animalId or conservancyId" }, { status: 400 });
  }

  const [animal, conservancy] = await Promise.all([
    body.animalId ? prisma.animal.findUnique({ where: { id: body.animalId } }) : null,
    body.conservancyId ? prisma.conservancy.findUnique({ where: { id: body.conservancyId } }) : null,
  ]);

  if (body.animalId && !animal) {
    return NextResponse.json({ error: "animalId does not match an existing animal" }, { status: 400 });
  }
  if (body.conservancyId && !conservancy) {
    return NextResponse.json({ error: "conservancyId does not match an existing conservancy" }, { status: 400 });
  }

  // Anyone can self-register a cause (see /api/cause/onboarding) with a
  // self-asserted name and mission — nothing else stops someone
  // impersonating a real org to redirect real sales to themselves. An
  // Animal's conservancy needs no separate check here: Animals are only
  // ever created by an admin picking from existing conservancies (see
  // /api/admin/animals), which is itself the vetting step.
  if (conservancy && !conservancy.verifiedAt) {
    return NextResponse.json(
      { error: "This cause hasn't been verified yet — an admin needs to review it before campaigns can support it" },
      { status: 403 },
    );
  }

  const causeSlug = animal ? animal.slug : slugify(conservancy!.name);

  try {
    const campaign = await prisma.campaign.create({
      data: {
        slug: `${causeSlug}-${seller.slug}`,
        animalId: animal?.id ?? null,
        conservancyId: conservancy?.id ?? null,
        artistId: seller.id,
        ...DEFAULT_SPLIT,
        status: "LIVE",
      },
    });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("You already have a campaign for this cause");
    }
    throw error;
  }
}
