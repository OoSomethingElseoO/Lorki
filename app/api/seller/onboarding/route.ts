import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

type OnboardBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
};

// Links a new Artist profile to the CURRENTLY LOGGED-IN user — this is
// what turns an existing plain account into a seller, no separate signup,
// no new credentials. If they already have one, this is a no-op redirect
// target, not an error.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  if (user.artist) {
    return NextResponse.json({ error: "You already have a seller profile" }, { status: 409 });
  }

  // One account, one role: a cause rep can't also become a seller (and
  // vice versa, see /api/cause/onboarding's mirror check) — these are two
  // different kinds of people in practice, and letting one login be both
  // was never a deliberate design choice, just an omission (this route
  // only ever checked its own role, not the other one).
  if (user.conservancy) {
    return NextResponse.json(
      { error: "This account is already registered as a cause — one account can't be both an artist and a cause." },
      { status: 409 },
    );
  }

  const body = (await request.json()) as Partial<OnboardBody>;

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return NextResponse.json({ error: "name, country, bio, and imageUrl are required" }, { status: 400 });
  }

  try {
    const artist = await prisma.artist.create({
      data: {
        slug: slugify(body.name),
        name: body.name,
        country: body.country,
        bio: body.bio,
        imageUrl: body.imageUrl,
        userId: user.id,
      },
    });

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An artist with this name already exists");
    }
    throw error;
  }
}
