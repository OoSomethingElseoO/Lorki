import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { decryptMfaSecret, hashChallengeToken, verifyRecoveryCode, verifyTotp } from "@/lib/mfa";
import { recordAudit } from "@/lib/audit";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/request-json";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = await readJsonObject(request) as Partial<{ challengeToken: string; code: string }> | null;
  if (!body?.challengeToken || !body.code) return apiContractError("INVALID_INPUT", "A verification code is required", 400);
  const ip = getRequestIp(request);
  if (await isRateLimited(`mfa:${ip}:${body.challengeToken.slice(0, 12)}`, 5, 5 * 60 * 1000)) {
    return apiContractError("RATE_LIMITED", "Too many verification attempts. Please sign in again.", 429);
  }

  const challenge = await prisma.mfaChallenge.findUnique({ where: { tokenHash: hashChallengeToken(body.challengeToken) }, include: { user: { include: { artist: true, conservancy: true } } } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || challenge.user.accountStatus !== "ACTIVE") {
    return apiContractError("MFA_CHALLENGE_EXPIRED", "This verification session has expired. Sign in again.", 401);
  }

  const updated = await prisma.mfaChallenge.updateMany({ where: { id: challenge.id, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
  if (updated.count !== 1) return apiContractError("MFA_CHALLENGE_EXPIRED", "This verification session has expired. Sign in again.", 401);

  const secret = decryptMfaSecret(challenge.user.mfaSecretEncrypted);
  let valid = Boolean(secret && verifyTotp(secret, body.code));
  let recoveryIndex = -1;
  if (!valid) {
    const recoveryCodes = await prisma.mfaRecoveryCode.findMany({ where: { userId: challenge.userId, usedAt: null }, select: { id: true, codeHash: true } });
    recoveryIndex = await verifyRecoveryCode(body.code, recoveryCodes.map((item) => item.codeHash));
    valid = recoveryIndex >= 0;
    if (valid) await prisma.mfaRecoveryCode.update({ where: { id: recoveryCodes[recoveryIndex].id }, data: { usedAt: new Date() } });
  }
  if (!valid && challenge.emailCodeHash && challenge.emailCodeExpiresAt && challenge.emailCodeExpiresAt > new Date() && challenge.emailCodeAttempts < 5) {
    valid = await verifyPassword(body.code, challenge.emailCodeHash);
    await prisma.mfaChallenge.update({ where: { id: challenge.id }, data: { emailCodeAttempts: { increment: 1 }, ...(valid ? { emailCodeHash: null, emailCodeExpiresAt: null } : {}) } });
  }
  if (!valid) {
    recordAudit({ action: "MFA_VERIFICATION_FAILED", affectedEntityType: "User", affectedEntityId: challenge.userId, reason: "Invalid MFA code", changedBy: challenge.user.email, metadata: { ip } }).catch(() => undefined);
    return apiContractError("INVALID_MFA_CODE", "That code is not valid. Check your authenticator and try again.", 401);
  }

  await prisma.mfaChallenge.delete({ where: { id: challenge.id } });
  const token = await createUserSessionToken(challenge.userId, undefined, true);
  recordAudit({ action: "MFA_VERIFICATION_SUCCEEDED", affectedEntityType: "User", affectedEntityId: challenge.userId, reason: recoveryIndex >= 0 ? "Recovery code accepted" : "Authenticator code accepted", changedBy: challenge.user.email, metadata: { ip, recoveryCode: recoveryIndex >= 0 } }).catch(() => undefined);
  const response = apiJson({ ok: true, isAdmin: challenge.user.isAdmin, hasArtist: Boolean(challenge.user.artist), hasConservancy: Boolean(challenge.user.conservancy) });
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return response;
}
