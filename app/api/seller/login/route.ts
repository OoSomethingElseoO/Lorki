import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createSellerSessionToken, SELLER_SESSION_COOKIE } from "@/lib/seller-auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`seller-login:${ip}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<{ email: string; password: string }>;

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const artist = await prisma.artist.findUnique({ where: { email: body.email.toLowerCase().trim() } });

  if (!artist || !artist.passwordHash || !(await verifyPassword(body.password, artist.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await createSellerSessionToken(artist.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SELLER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
