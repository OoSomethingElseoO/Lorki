import { User } from "@prisma/client";
import { apiContractError } from "@/lib/api-contract";

export function checkPermission(
  user: User | null,
  requiredRole: "SUPER_ADMIN" | "FINANCE_ADMIN" | "OPS_ADMIN" | "VIEWER" | "ADMIN"
) {
  if (!user?.isAdmin) {
    return { authorized: false, error: "Admin access required" };
  }

  // ADMIN is a catch-all for any admin
  if (requiredRole === "ADMIN") {
    return { authorized: true };
  }

  const roleHierarchy: Record<string, number> = {
    SUPER_ADMIN: 4,
    FINANCE_ADMIN: 3,
    OPS_ADMIN: 2,
    VIEWER: 1,
  };

  const userLevel = roleHierarchy[user.adminRole || "VIEWER"] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  if (userLevel >= requiredLevel) {
    return { authorized: true };
  }

  return { authorized: false, error: `${requiredRole} access required` };
}

export function unauthorized(role: string) {
  return apiContractError("FORBIDDEN", `${role} access required`, 403, { requiredRole: role });
}
