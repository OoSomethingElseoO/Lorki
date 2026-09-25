import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { readJsonObject } from "@/lib/request-json";
import { validateTextField } from "@/lib/validation";

type RouteContext = { params: Promise<{ id: string }> };
const priorities = new Set(["LOW", "NORMAL", "HIGH", "CRITICAL"]);

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) return unauthorized("FINANCE_ADMIN");

  const { id } = await params;
  const body = await readJsonObject(request) as { note?: unknown; priority?: unknown; assignedTo?: unknown; status?: unknown } | null;
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  const requestedStatus = body?.status === "RESOLVED" ? "RESOLVED" : undefined;
  const priority = typeof body?.priority === "string" && priorities.has(body.priority) ? body.priority as "LOW" | "NORMAL" | "HIGH" | "CRITICAL" : undefined;
  const assignedTo = typeof body?.assignedTo === "string" ? body.assignedTo.trim().slice(0, 320) : undefined;
  if (body?.priority !== undefined && !priority) return NextResponse.json({ error: "Invalid reconciliation priority" }, { status: 400 });
  if (body?.assignedTo !== undefined && !assignedTo) return NextResponse.json({ error: "assignedTo cannot be empty" }, { status: 400 });
  if (!requestedStatus && !priority && assignedTo === undefined && !note) return NextResponse.json({ error: "Provide a status, priority, assignee, or triage note" }, { status: 400 });
  if (requestedStatus === "RESOLVED") {
    const noteError = validateTextField(note, { minLength: 5, maxLength: 2000, name: "Resolution note" });
    if (noteError) return NextResponse.json({ error: noteError }, { status: 400 });
  }

  const existing = await prisma.paymentReconciliation.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Reconciliation case not found" }, { status: 404 });
  if (existing.status === "RESOLVED" && requestedStatus !== "RESOLVED") return NextResponse.json({ reconciliation: existing, alreadyResolved: true });

  const now = new Date();
  const resolvedBy = user?.email ?? "unknown-admin";
  const reconciliation = await prisma.$transaction(async (tx) => {
    const updated = await tx.paymentReconciliation.update({
      where: { id },
      data: {
        ...(requestedStatus === "RESOLVED" ? { status: "RESOLVED", resolvedAt: now, resolvedBy, resolutionNote: note } : {}),
        ...(priority ? { priority, triagedAt: now, triagedBy: resolvedBy } : {}),
        ...(assignedTo !== undefined ? { assignedTo, triagedAt: now, triagedBy: resolvedBy } : {}),
        ...(requestedStatus !== "RESOLVED" && note ? { triageNote: note, triagedAt: now, triagedBy: resolvedBy } : {}),
      },
    });
    await tx.auditLog.create({
      data: {
        action: requestedStatus === "RESOLVED" ? "PAYMENT_RECONCILIATION_RESOLVED" : "PAYMENT_RECONCILIATION_TRIAGED",
        affectedEntityType: "PaymentReconciliation",
        affectedEntityId: id,
        reason: note || "Reconciliation case triage updated",
        changedBy: resolvedBy,
        metadata: {
          provider: existing.provider,
          externalId: existing.externalId,
          previousStatus: existing.status,
          priority,
          assignedTo,
          orderId: existing.orderId,
          payoutId: existing.payoutId,
        },
      },
    });
    return updated;
  });

  return NextResponse.json({ reconciliation });
}
