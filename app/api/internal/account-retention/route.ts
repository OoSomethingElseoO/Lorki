import { NextResponse } from "next/server";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const RETENTION_YEARS = 7;
const BATCH_SIZE = 50;

function authorized(request: Request) {
  const expected = process.env.ACCOUNT_RETENTION_SECRET;
  const supplied = request.headers.get("x-account-retention-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Bounded, idempotent retention sweep. It anonymizes eligible identity data
 * while preserving order/payment/audit evidence required for reconciliation. */
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
  const candidates = await prisma.user.findMany({
    where: { accountStatus: "DELETION_APPROVED", deletionApprovedAt: { lte: cutoff }, OR: [{ legalHoldUntil: null }, { legalHoldUntil: { lt: now } }], anonymizedAt: null },
    select: { id: true, email: true }, orderBy: { deletionApprovedAt: "asc" }, take: BATCH_SIZE,
  });
  let anonymized = 0;
  for (const user of candidates) {
    const completedAt = new Date();
    const changed = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({ where: { id: user.id, accountStatus: "DELETION_APPROVED", anonymizedAt: null }, data: { accountStatus: "ANONYMIZED", anonymizedAt: completedAt, name: null, email: `deleted-${user.id}@invalid.lorki`, passwordHash: randomBytes(48).toString("hex"), sessionVersion: { increment: 1 } } });
      if (updated.count !== 1) return false;
      await tx.passwordHistory.deleteMany({ where: { userId: user.id } });
      await tx.accountDeletionRequest.updateMany({ where: { userId: user.id, status: "APPROVED", completedAt: null }, data: { completedAt } });
      return true;
    });
    if (changed) {
      anonymized += 1;
      await recordAudit({ action: "ACCOUNT_ANONYMIZED", affectedEntityType: "User", affectedEntityId: user.id, reason: `Retention sweep after ${RETENTION_YEARS} years`, changedBy: "system:account-retention", metadata: { originalEmail: user.email, cutoff: cutoff.toISOString() } });
    }
  }
  return NextResponse.json({ ok: true, cutoff, scanned: candidates.length, anonymized, hasMore: candidates.length === BATCH_SIZE });
}
