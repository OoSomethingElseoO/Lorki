import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";
import { recordAudit } from "@/lib/audit";
import { sendDeletionDecisionEmail } from "@/lib/email";

type RouteParams = { params: Promise<{ id: string }> };
type ReviewAction = "APPROVE" | "REJECT" | "RESTORE" | "SUSPEND";

export async function GET(request: Request, { params }: RouteParams) {
  const reviewer = await getCurrentUser(request);
  const { authorized } = checkPermission(reviewer, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const requests = await prisma.accountDeletionRequest.findMany({
    where: { userId: id }, orderBy: { requestedAt: "desc" }, take: 20,
  });
  return NextResponse.json({ requests });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const reviewer = await getCurrentUser(request);
  const { authorized } = checkPermission(reviewer, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as { action?: unknown; note?: unknown } | null;
  const action = body?.action as ReviewAction | undefined;
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 2000) : null;
  if (!action || !["APPROVE", "REJECT", "RESTORE", "SUSPEND"].includes(action)) {
    return apiContractError("VALIDATION_ERROR", "action must be APPROVE, REJECT, RESTORE, or SUSPEND", 400);
  }

  const latest = await prisma.accountDeletionRequest.findFirst({ where: { userId: id }, orderBy: { requestedAt: "desc" } });
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, accountStatus: true, legalHoldUntil: true } });
  if (!target || !latest) return apiContractError("NOT_FOUND", "User deletion request not found", 404);
  if (action === "APPROVE" && target.legalHoldUntil && target.legalHoldUntil > new Date()) {
    return apiContractError("CONFLICT", "This account is under legal hold and cannot be approved for deletion", 409);
  }

  const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const status = action === "APPROVE" ? "DELETION_APPROVED" : action === "RESTORE" || action === "REJECT" ? "ACTIVE" : "SUSPENDED";
    const requestStatus = action === "APPROVE" ? "APPROVED" : action === "RESTORE" ? "RESTORED" : action === "REJECT" ? "REJECTED" : latest.status;
    const updatedRequest = await tx.accountDeletionRequest.update({ where: { id: latest.id }, data: { status: requestStatus, reviewedAt: now, reviewedBy: reviewer!.id, reviewNote: note } });
    const updatedUser = await tx.user.update({ where: { id }, data: { accountStatus: status, deletionApprovedAt: action === "APPROVE" ? now : null, sessionVersion: { increment: 1 } }, select: { id: true, email: true, accountStatus: true } });
    return { updatedRequest, updatedUser };
  });

  await recordAudit({ action: `ACCOUNT_DELETION_${action}`, affectedEntityType: "User", affectedEntityId: id, reason: note || `Admin performed ${action.toLowerCase()} on account deletion request`, changedBy: reviewer!.email, metadata: { requestId: latest.id } });
  if (action === "APPROVE" || action === "REJECT" || action === "RESTORE") sendDeletionDecisionEmail(target.email, action.toLowerCase(), note ?? "").catch(() => undefined);
  return NextResponse.json({ ok: true, ...result });
}
