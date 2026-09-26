import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { parseSecurityCaseUpdate } from "@/lib/security-case-validation";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser(request);
  if (!checkPermission(user, "OPS_ADMIN").authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = parseSecurityCaseUpdate(await readJsonObject(request));
  if (!body) return apiContractError("VALIDATION_ERROR", "Invalid security case update", 400);
  const existing = await prisma.securityCase.findUnique({ where: { id } });
  if (!existing) return apiContractError("NOT_FOUND", "Security case not found", 404);
  const status = body.status;
  const updated = await prisma.securityCase.update({ where: { id }, data: { ...(status ? { status } : {}), ...(body.severity ? { severity: body.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" } : {}), ...(typeof body.assignedTo === "string" ? { assignedTo: body.assignedTo.trim() || null } : {}), ...(typeof body.triageNote === "string" ? { triageNote: body.triageNote.trim() } : {}), ...(status === "RESOLVED" || status === "FALSE_POSITIVE" ? { resolvedAt: new Date(), resolvedBy: user!.email, resolutionNote: typeof body.resolutionNote === "string" ? body.resolutionNote.trim() : null } : {}) } });
  await recordAudit({ action: "SECURITY_CASE_UPDATED", affectedEntityType: "SecurityCase", affectedEntityId: id, reason: body.triageNote || "Security case triage updated", changedBy: user!.email, metadata: { previousStatus: existing.status, status: updated.status, severity: updated.severity, assignedTo: updated.assignedTo } });
  return NextResponse.json({ securityCase: updated });
}
