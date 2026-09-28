import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type OnboardBody = {
  name: string;
  country: string;
  countryCode?: string;
  bio: string;
  story?: string;
  imageUrl: string;
};

// Links a new Artist profile to the CURRENTLY LOGGED-IN user — this is
// what turns an existing plain account into an artist, no separate signup,
// no new credentials. If they already have one, this is a no-op redirect
// target, not an error.
export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  if (user.artist) {
    return apiContractError("CONFLICT", "You already have an artist profile", 409);
  }

  const body = await readJsonObject(request) as Partial<OnboardBody> | null;
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
        userId: user.id,
      },
    });
    await recordAudit({ action: "ARTIST_ONBOARDED", affectedEntityType: "Artist", affectedEntityId: artist.id, reason: "User created an artist profile", changedBy: user.email, metadata: { country: artist.country } });

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An artist with this name already exists");
    }
    throw error;
  }
}
