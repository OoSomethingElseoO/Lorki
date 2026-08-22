import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSellerSessionToken, SELLER_SESSION_COOKIE } from "@/lib/seller-auth";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

type SignupBody = {
  name: string;
  email: string;
  password: string;
  country: string;
};

// Full self-service: anyone can sign up as a seller and start listing
// immediately, no admin approval step. Minimal fields at signup — bio,
// image, socials get filled in afterward from the seller's own profile page.
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`seller-signup:${ip}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<SignupBody>;

  if (!body.name || !body.email || !body.password || !body.country) {
    return NextResponse.json({ error: "name, email, password, and country are required" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const artist = await prisma.artist.create({
      data: {
        slug: slugify(body.name),
        name: body.name,
        country: body.country,
        bio: "",
        imageUrl: "/placeholders/artist-portrait.svg",
        email: body.email.toLowerCase().trim(),
        passwordHash: await hashPassword(body.password),
      },
    });

    const token = await createSellerSessionToken(artist.id);
    const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(SELLER_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An account with this email or name already exists");
    }
    throw error;
  }
}
