import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type ProfileUpdateBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
};

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json()) as Partial<ProfileUpdateBody>;

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return NextResponse.json({ error: "name, country, bio, and imageUrl are required" }, { status: 400 });
  }

  // Slug stays fixed once set — same immutable-identifier rule as
  // everywhere else in this app (public artist URLs shouldn't break on a
  // name change).
  const artist = await prisma.artist.update({
    where: { id: seller.id },
    data: {
      name: body.name,
      country: body.country,
      bio: body.bio,
      imageUrl: body.imageUrl,
    },
  });

  return NextResponse.json({ artist });
}
