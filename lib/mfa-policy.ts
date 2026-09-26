import { apiContractError } from "@/lib/api-contract";
import { getCurrentUser, hasMfaVerifiedSession } from "@/lib/auth";
import { getMfaPolicy } from "@/lib/settings";

export async function enforceHighRiskMfa(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return apiContractError("UNAUTHENTICATED", "Sign in required", 401);
  const policy = await getMfaPolicy();
  if (!policy.requireMfaForHighRisk) return null;
  if (!user.mfaEnabled) return apiContractError("MFA_ENROLLMENT_REQUIRED", "Enable MFA before performing this action", 403);
  if (!(await hasMfaVerifiedSession(request))) return apiContractError("MFA_REQUIRED", "Complete MFA verification before performing this action", 403);
  return null;
}
