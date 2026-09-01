import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`login:${ip}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<{ email: string; password: string }>;

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
    include: { artist: true, conservancy: true },
  });

  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await createUserSessionToken(user.id);
  // Booleans only, not the actual Artist/Conservancy rows — just enough
  // for the client to pick a sensible post-login landing page (see
  // LoginForm) without a second round trip. Never used for authorization
  // decisions; every protected route still re-checks the real thing via
  // getCurrentUser().
  const response = NextResponse.json({
    ok: true,
    isAdmin: user.isAdmin,
    hasArtist: Boolean(user.artist),
    hasConservancy: Boolean(user.conservancy),
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
