import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/email";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`forgot-password:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<{ email: string }>;

  if (!body.email) {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });

  // Always report success — confirming whether an email is registered is a
  // real information leak for an account-recovery endpoint.
  if (user) {
    const rawToken = randomBytes(32).toString("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    // Not awaited — the reset token above is already committed, and not
    // blocking on Resend here also narrows the timing gap between a
    // registered and unregistered email a little further (see this
    // route's own "always report success" comment above).
    const origin = request.headers.get("origin") ?? new URL(request.url).origin;
    sendPasswordResetEmail({
      to: user.email,
      resetUrl: `${origin}/reset-password/${rawToken}`,
    });
  }

  return NextResponse.json({ ok: true });
}
