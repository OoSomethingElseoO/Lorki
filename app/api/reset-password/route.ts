import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { apiContractError } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { validatePassword } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";
import { passwordWasRecentlyUsed } from "@/lib/password-history";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function POST(request: Request) {
  if (await isRateLimited(`reset-password:${getRequestIp(request)}`, 10, 15 * 60 * 1000)) {
    return apiContractError("RATE_LIMITED", "Too many password reset attempts. Please try again later.", 429);
  }
  const body = await readJsonObject(request) as Partial<{ token: string; password: string; passwordConfirmation: string }> | null;

  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.token || !body.password || !body.passwordConfirmation) {
    return apiContractError("VALIDATION_ERROR", "Token, password, and password confirmation are required", 400);
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(body.token) },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return apiContractError("INVALID_RESET_TOKEN", "This reset link is invalid or has expired", 400);
  }
  const passwordError = validatePassword(body.password, { email: resetToken.user.email, name: resetToken.user.name ?? undefined });
  if (passwordError) return apiContractError("VALIDATION_ERROR", passwordError, 400);
  if (body.password !== body.passwordConfirmation) {
    return apiContractError("VALIDATION_ERROR", "Passwords do not match", 400, { field: "passwordConfirmation" });
  }
  if (await passwordWasRecentlyUsed(resetToken.userId, body.password)) {
    return apiContractError("PASSWORD_REUSED", "Choose a password you have not used recently", 409);
  }

  const passwordHash = await hashPassword(body.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    }),
    prisma.passwordHistory.create({ data: { userId: resetToken.userId, passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
