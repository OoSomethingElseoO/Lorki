import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNotFoundError } from "@/lib/prisma-errors";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { sendMfaReminderEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser(request);
  const { authorized } = checkPermission(currentUser, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as { action?: string } | null;
  if (body?.action !== "SEND_MFA_REMINDER") return apiContractError("INVALID_INPUT", "Unsupported user action", 400);
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return apiContractError("NOT_FOUND", "User not found", 404);
  if (target.mfaEnabled) return apiContractError("CONFLICT", "MFA is already enabled for this user", 409);
  const settings = await getSettings();
  await sendMfaReminderEmail(target.email, settings.siteName?.trim() || "Lorki Originals");
  await recordAudit({ action: "MFA_REMINDER_SENT", affectedEntityType: "User", affectedEntityId: id, reason: "Administrator sent an MFA enrollment reminder", changedBy: currentUser!.email, metadata: { targetEmail: target.email } });
  return NextResponse.json({ ok: true });
}

// "Delete" here means revoke admin access, not destroy the account — the
// target row is a shared identity that may also be an artist (linked
// Artist) or have real order history, so removing the row entirely would
// take those down with it. Setting isAdmin back to false is the correct
// operation; the account itself, and anything else attached to it, is
// untouched.
export async function DELETE(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser(request);
  const { authorized } = checkPermission(currentUser, "SUPER_ADMIN");
  if (!authorized) return unauthorized("SUPER_ADMIN");
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !target.isAdmin) {
    return apiContractError("NOT_FOUND", "Admin not found", 404);
  }

  // Never let the app lock itself out of /admin entirely.
  const totalAdmins = await prisma.user.count({ where: { isAdmin: true } });
  if (totalAdmins <= 1) {
    return apiContractError("CONFLICT", "Can't remove the last remaining admin", 400);
  }

  // Never let an admin remove their own access — avoids an accidental
  // self-lockout when they're the only one currently signed in.
  if (currentUser?.id === id) {
    return apiContractError("CONFLICT", "You can't remove your own admin access while signed in as it", 400);
  }

  try {
    await prisma.user.update({ where: { id }, data: { isAdmin: false } });
    await recordAudit({ action: "ADMIN_ACCESS_REVOKED", affectedEntityType: "User", affectedEntityId: id, reason: "Super administrator revoked admin access", changedBy: currentUser!.email, metadata: { targetEmail: target.email } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Admin not found", 404);
    }
    throw error;
  }
}
