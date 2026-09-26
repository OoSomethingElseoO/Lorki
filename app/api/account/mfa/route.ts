import { apiContractError, apiJson } from "@/lib/api-contract";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createChallengeToken, createRecoveryCodes, decryptMfaSecret, encryptMfaSecret, generateMfaSecret, buildOtpAuthUri, hashChallengeToken, verifyTotp } from "@/lib/mfa";
import { recordAudit } from "@/lib/audit";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return apiContractError("UNAUTHENTICATED", "Sign in required", 401);
  return apiJson({ enabled: user.mfaEnabled, enabledAt: user.mfaEnabledAt });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return apiContractError("UNAUTHENTICATED", "Sign in required", 401);
  const body = await readJsonObject(request) as Partial<{ action: "setup" | "confirm"; setupToken: string; code: string }> | null;
  if (body?.action === "confirm") {
    if (!body.setupToken || !body.code) return apiContractError("INVALID_INPUT", "Setup token and authenticator code are required", 400);
    const setup = await prisma.mfaSetup.findFirst({ where: { userId: user.id, tokenHash: hashChallengeToken(body.setupToken), expiresAt: { gt: new Date() } } });
    const secret = decryptMfaSecret(setup?.secretEncrypted);
    if (!setup || !secret || !verifyTotp(secret, body.code)) return apiContractError("INVALID_MFA_CODE", "That authenticator code is not valid", 400);
    const recovery = await createRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { mfaEnabled: true, mfaSecretEncrypted: setup.secretEncrypted, mfaEnabledAt: new Date(), sessionVersion: { increment: 1 } } });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({ data: recovery.hashes.map((codeHash) => ({ userId: user.id, codeHash })) });
      await tx.mfaSetup.delete({ where: { id: setup.id } });
    });
    recordAudit({ action: "MFA_ENABLED", affectedEntityType: "User", affectedEntityId: user.id, reason: "User enabled authenticator MFA", changedBy: user.email }).catch(() => undefined);
    return apiJson({ enabled: true, recoveryCodes: recovery.plain });
  }

  const secret = generateMfaSecret();
  const setupToken = createChallengeToken();
  await prisma.mfaSetup.deleteMany({ where: { userId: user.id } });
  await prisma.mfaSetup.create({ data: { userId: user.id, tokenHash: hashChallengeToken(setupToken), secretEncrypted: encryptMfaSecret(secret), expiresAt: new Date(Date.now() + 10 * 60 * 1000) } });
  return apiJson({ setupToken, secret, otpauthUri: buildOtpAuthUri(user.email, secret), expiresInSeconds: 600 });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return apiContractError("UNAUTHENTICATED", "Sign in required", 401);
  const body = await readJsonObject(request) as Partial<{ code: string }> | null;
  if (!body?.code || !user.mfaSecretEncrypted) return apiContractError("INVALID_INPUT", "Authenticator or recovery code is required", 400);
  const secret = decryptMfaSecret(user.mfaSecretEncrypted);
  if (!secret || !verifyTotp(secret, body.code)) return apiContractError("INVALID_MFA_CODE", "That authenticator code is not valid", 400);
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaEnabledAt: null, sessionVersion: { increment: 1 } } }),
    prisma.mfaRecoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);
  recordAudit({ action: "MFA_DISABLED", affectedEntityType: "User", affectedEntityId: user.id, reason: "User disabled authenticator MFA", changedBy: user.email }).catch(() => undefined);
  return apiJson({ enabled: false });
}
