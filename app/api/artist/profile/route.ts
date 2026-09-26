import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateTextField, validateCountryCode, validateImageUrl } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { artistRequired } from "@/lib/authorization";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type ProfileUpdateBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
};

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser(request);
  const currentArtist = artistRequired(currentUser);
  if (!currentArtist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const body = await readJsonObject(request) as Partial<ProfileUpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return apiContractError("VALIDATION_ERROR", "name, country, bio, and imageUrl are required", 400);
  }

  // ✅ Comprehensive validation
  const nameError = validateTextField(body.name, {
    minLength: 1,
    maxLength: 200,
    name: "Name",
  });
  if (nameError) {
    return apiContractError("VALIDATION_ERROR", nameError, 400);
  }

  const countryError = validateCountryCode(body.country);
  if (countryError) {
    return apiContractError("VALIDATION_ERROR", countryError, 400);
  }

  const bioError = validateTextField(body.bio, {
    minLength: 1,
    maxLength: 2000,
    name: "Bio",
  });
  if (bioError) {
    return apiContractError("VALIDATION_ERROR", bioError, 400);
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return apiContractError("VALIDATION_ERROR", imageError, 400);
  }

  // Slug stays fixed once set — same immutable-identifier rule as
  // everywhere else in this app (public artist URLs shouldn't break on a
  // name change).
  const artist = await prisma.artist.update({
    where: { id: currentArtist.id },
    data: {
      name: body.name,
      country: body.country,
      bio: body.bio,
      imageUrl: body.imageUrl,
    },
  });
  await recordAudit({ action: "ARTIST_PROFILE_UPDATED", affectedEntityType: "Artist", affectedEntityId: currentArtist.id, reason: "Artist updated their public profile", changedBy: currentUser!.email, metadata: { fields: ["name", "country", "bio", "imageUrl"] } });

  return NextResponse.json({ artist });
}
