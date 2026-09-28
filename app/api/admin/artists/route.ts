import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const artists = await prisma.artist.findMany({
    include: { socialLinks: true, coOp: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ artists });
}

type CreateBody = {
  name: string;
  country: string;
  countryCode?: string;
  bio: string;
  story?: string;
  imageUrl: string;
  coOpId?: string;
  socialLinks?: { platform: string; url: string }[];
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return apiContractError("VALIDATION_ERROR", "name, country, bio, and imageUrl are required", 400);
  }
  if (body.countryCode && !/^[A-Z]{2}$/.test(body.countryCode)) {
    return apiContractError("VALIDATION_ERROR", "countryCode must be a two-letter ISO country code", 400);
  }
  if (body.story && body.story.length > 4000) {
    return apiContractError("VALIDATION_ERROR", "Story must be 4000 characters or fewer", 400);
  }

  if (body.coOpId) {
    const coOp = await prisma.coOp.findUnique({ where: { id: body.coOpId } });
    if (!coOp) {
      return apiContractError("VALIDATION_ERROR", "coOpId does not match an existing co-op", 400);
    }
  }

  const socialLinks = (body.socialLinks ?? []).filter((link) => link.platform && link.url);

  try {
    const artist = await prisma.artist.create({
      data: {
        slug: slugify(body.name),
        name: body.name,
        country: body.country,
        countryCode: body.countryCode || null,
        bio: body.bio,
        story: body.story || null,
        imageUrl: body.imageUrl,
        coOpId: body.coOpId || null,
        socialLinks: { create: socialLinks },
      },
      include: { socialLinks: true },
    });

    await recordAudit({ action: "ARTIST_CREATED", affectedEntityType: "Artist", affectedEntityId: artist.id, reason: "Operations administrator created an artist record", changedBy: user!.email, metadata: { name: artist.name, coOpId: artist.coOpId } });

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An artist with this name already exists");
    }
    throw error;
  }
}
