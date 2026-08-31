import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

// Creates a plain account — nothing more. Becoming an artist (linking an
// Artist profile) or an admin are separate, later steps on top of this
// same login, not different signup forms.
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`signup:${ip}`, 5, 5 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many signup attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<{ name: string; email: string; password: string }>;

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        passwordHash: await hashPassword(body.password),
        name: body.name || null,
      },
    });

    const token = await createUserSessionToken(user.id);
    const response = NextResponse.json({ ok: true }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An account with this email already exists");
    }
    throw error;
  }
}
