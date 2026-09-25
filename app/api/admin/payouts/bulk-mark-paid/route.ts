import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

type BulkBody = { payoutIds?: string[] };

// Bulk sibling of [id]/mark-paid — same idempotent, RELEASED-only rule,
// just applied to a set of ids in one round trip instead of one at a time.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) return unauthorized("FINANCE_ADMIN");
  const body = (await request.json()) as Partial<BulkBody>;

  if (!Array.isArray(body.payoutIds) || body.payoutIds.length === 0) {
    return NextResponse.json({ error: "payoutIds must be a non-empty array" }, { status: 400 });
  }

  const result = await prisma.payout.updateMany({
    where: { id: { in: body.payoutIds }, status: "RELEASED", paidOutAt: null },
    data: { paidOutAt: new Date() },
  });

  await recordAudit({ action: "PAYOUTS_MARKED_PAID_BULK", affectedEntityType: "Payout", affectedEntityId: "bulk", reason: "Finance administrator recorded multiple external payouts", changedBy: user!.email, metadata: { requestedIds: body.payoutIds, updatedCount: result.count } });
  return NextResponse.json({ count: result.count });
}
