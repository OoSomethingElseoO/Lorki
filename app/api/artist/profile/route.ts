import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateTextField, validateCountryCode, validateImageUrl } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";

type ProfileUpdateBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
};

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const currentArtist = currentUser?.artist;
  if (!currentArtist) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<ProfileUpdateBody>;

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return NextResponse.json({ error: "name, country, bio, and imageUrl are required" }, { status: 400 });
  }

  // ✅ Comprehensive validation
  const nameError = validateTextField(body.name, {
    minLength: 1,
    maxLength: 200,
    name: "Name",
  });
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  const countryError = validateCountryCode(body.country);
  if (countryError) {
    return NextResponse.json({ error: countryError }, { status: 400 });
  }

  const bioError = validateTextField(body.bio, {
    minLength: 1,
    maxLength: 2000,
    name: "Bio",
  });
  if (bioError) {
    return NextResponse.json({ error: bioError }, { status: 400 });
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
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
