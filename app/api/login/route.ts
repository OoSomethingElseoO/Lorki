import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { validateEmail } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";
import { recordAudit } from "@/lib/audit";
import { createChallengeToken, hashChallengeToken } from "@/lib/mfa";
import { getMfaPolicy } from "@/lib/settings";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`login:${ip}`, 5, 5 * 60 * 1000)) {
    recordAudit({ action: "LOGIN_RATE_LIMITED", affectedEntityType: "Auth", affectedEntityId: "anonymous", reason: "Login rate limit exceeded", changedBy: "anonymous", metadata: { ip } }).catch(() => undefined);
    return apiContractError("RATE_LIMITED", "Too many login attempts. Please try again in a few minutes.", 429);
  }

  const body = await readJsonObject(request) as Partial<{ email: string; password: string }> | null;

  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.email || !body.password) {
    return apiContractError("INVALID_INPUT", "Email and password are required", 400);
  }

  // ✅ Email validation
  const emailError = validateEmail(body.email);
  if (emailError) {
    return apiContractError("INVALID_EMAIL", emailError, 400, { field: "email" });
  }

  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
    include: { artist: true, conservancy: true },
  });

  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    recordAudit({ action: "LOGIN_FAILED", affectedEntityType: "Auth", affectedEntityId: user?.id ?? "unknown", reason: "Invalid email or password", changedBy: body.email.toLowerCase().trim(), metadata: { ip } }).catch(() => undefined);
    return apiContractError("INVALID_CREDENTIALS", "Incorrect email or password", 401);
  }

  if (user.accountStatus !== "ACTIVE") {
    recordAudit({ action: "LOGIN_BLOCKED_ACCOUNT_STATE", affectedEntityType: "User", affectedEntityId: user.id, reason: `Login blocked for account state ${user.accountStatus}`, changedBy: user.email, metadata: { ip, accountStatus: user.accountStatus } }).catch(() => undefined);
    return apiContractError("ACCOUNT_UNAVAILABLE", "This account is not available. Contact support if you need help restoring access.", 403);
  }

  const mfaPolicy = await getMfaPolicy();
  if (mfaPolicy.requireMfaForAdmins && user.isAdmin && !user.mfaEnabled) {
    recordAudit({ action: "LOGIN_BLOCKED_MFA_ENROLLMENT_REQUIRED", affectedEntityType: "User", affectedEntityId: user.id, reason: "Administrator MFA policy requires enrollment", changedBy: user.email, metadata: { ip } }).catch(() => undefined);
    return apiContractError("MFA_ENROLLMENT_REQUIRED", "MFA enrollment is required for administrator accounts. Contact an administrator or sign in after enrollment.", 403);
  }

  if (user.mfaEnabled) {
    const challengeToken = createChallengeToken();
    await prisma.mfaChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.mfaChallenge.create({
      data: {
        userId: user.id,
        tokenHash: hashChallengeToken(challengeToken),
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    });
    recordAudit({ action: "LOGIN_PASSWORD_VERIFIED_MFA_REQUIRED", affectedEntityType: "User", affectedEntityId: user.id, reason: "Password verified; second factor required", changedBy: user.email, metadata: { ip } }).catch(() => undefined);
    return apiJson({ ok: true, mfaRequired: true, challengeToken }, { status: 202 });
  }

  const token = await createUserSessionToken(user.id);
  recordAudit({ action: "LOGIN_SUCCEEDED", affectedEntityType: "User", affectedEntityId: user.id, reason: "User authenticated successfully", changedBy: user.email, metadata: { ip, isAdmin: user.isAdmin } }).catch(() => undefined);
  // Booleans only, not the actual Artist/Conservancy rows — just enough
  // for the client to pick a sensible post-login landing page (see
  // LoginForm) without a second round trip. Never used for authorization
  // decisions; every protected route still re-checks the real thing via
  // getCurrentUser().
  const response = apiJson({
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
