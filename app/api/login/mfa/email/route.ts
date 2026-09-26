import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { hashChallengeToken } from "@/lib/mfa";
import { hashPassword } from "@/lib/password";
import { getMfaPolicy, getSettings } from "@/lib/settings";
import { sendMfaEmailOtp } from "@/lib/email";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/request-json";

export async function POST(request: Request) {
  const body = await readJsonObject(request) as Partial<{ challengeToken: string }> | null;
  if (!body?.challengeToken) return apiContractError("INVALID_INPUT", "Challenge token is required", 400);
  const policy = await getMfaPolicy();
  if (!policy.allowMfaEmailOtp) return apiContractError("MFA_EMAIL_DISABLED", "Email OTP fallback is not enabled", 403);
  const ip = getRequestIp(request);
  if (await isRateLimited(`mfa-email:${ip}:${body.challengeToken.slice(0, 12)}`, 2, 10 * 60 * 1000)) return apiContractError("RATE_LIMITED", "Please wait before requesting another email code", 429);
  const challenge = await prisma.mfaChallenge.findUnique({ where: { tokenHash: hashChallengeToken(body.challengeToken), }, include: { user: true } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.user.accountStatus !== "ACTIVE") return apiContractError("MFA_CHALLENGE_EXPIRED", "This verification session has expired. Sign in again.", 401);
  const code = String(randomInt(100000, 1000000));
  await prisma.mfaChallenge.update({ where: { id: challenge.id }, data: { emailCodeHash: await hashPassword(code), emailCodeExpiresAt: new Date(Date.now() + 10 * 60 * 1000), emailCodeAttempts: 0 } });
  const settings = await getSettings();
  await sendMfaEmailOtp(challenge.user.email, code, settings.siteName?.trim() || "Lorki Originals");
  return apiJson({ ok: true, expiresInSeconds: 600 });
}
import { randomInt } from "node:crypto";
