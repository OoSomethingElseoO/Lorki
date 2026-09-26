import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { artistRequired } from "@/lib/authorization";
import { DEFAULT_SPLIT } from "@/lib/payouts";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { slugify } from "@/lib/slugify";
import { recordAudit } from "@/lib/audit";
import { apiContractError, apiJson } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: artist.id },
    include: { animal: { include: { conservancy: true } }, conservancy: true, artworks: true },
    orderBy: { createdAt: "desc" },
  });

  return apiJson({ campaigns });
}

type CreateBody = { animalId?: string; conservancyId?: string };

// Full self-service: picks either an existing (admin-vetted) animal — the
// wildlife-portrait case this app started as — or, for anything else,
// picks a registered cause directly (no animal involved at all; see the
// schema comment on Campaign). Exactly one of the two, never both/neither.
// Born DRAFT, not LIVE — the artist can submit artwork into it right away
// (see /api/artist/artworks), but nothing here reaches a buyer until an
// admin reviews it, sets the real price, and flips it to LIVE via the
// existing admin status control — no separate "pending" concept needed,
// DRAFT already means exactly this. The split ratio is fixed
// (DEFAULT_SPLIT), never settable here; see lib/payouts.ts for why.
export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (Boolean(body.animalId) === Boolean(body.conservancyId)) {
    return apiContractError("VALIDATION_ERROR", "Provide exactly one of animalId or conservancyId", 400);
  }

  const [animal, conservancy] = await Promise.all([
    body.animalId ? prisma.animal.findUnique({ where: { id: body.animalId } }) : null,
    body.conservancyId ? prisma.conservancy.findUnique({ where: { id: body.conservancyId } }) : null,
  ]);

  if (body.animalId && !animal) {
    return apiContractError("NOT_FOUND", "animalId does not match an existing animal", 404);
  }
  if (body.conservancyId && !conservancy) {
    return apiContractError("NOT_FOUND", "conservancyId does not match an existing conservancy", 404);
  }

  // Anyone can self-register a cause (see /api/cause/onboarding) with a
  // self-asserted name and mission — nothing else stops someone
  // impersonating a real org to redirect real sales to themselves. An
  // Animal's conservancy needs no separate check here: Animals are only
  // ever created by an admin picking from existing conservancies (see
  // /api/admin/animals), which is itself the vetting step.
  if (conservancy && !conservancy.verifiedAt) {
    return apiContractError("FORBIDDEN", "This cause hasn't been verified yet — an admin needs to review it before campaigns can support it", 403);
  }

  const causeSlug = animal ? animal.slug : slugify(conservancy!.name);

  try {
    const campaign = await prisma.campaign.create({
      data: {
        slug: `${causeSlug}-${artist.slug}`,
        animalId: animal?.id ?? null,
        conservancyId: conservancy?.id ?? null,
        artistId: artist.id,
        ...DEFAULT_SPLIT,
        status: "DRAFT",
      },
    });
    await recordAudit({ action: "ARTIST_CAMPAIGN_CREATED", affectedEntityType: "Campaign", affectedEntityId: campaign.id, reason: "Artist created a draft campaign", changedBy: currentUser!.email, metadata: { animalId: campaign.animalId, conservancyId: campaign.conservancyId } });

    return NextResponse.json({ campaign }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("You already have a campaign for this cause");
    }
    throw error;
  }
}
