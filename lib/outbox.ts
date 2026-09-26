import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const OUTBOX_ORDER_CONFIRMATION = "ORDER_CONFIRMATION_EMAIL";
/** Keep an accidentally unscheduled worker from creating unbounded work. */
export const OUTBOX_MAX_BACKLOG = 1_000;
export const OUTBOX_MAX_BATCH = 50;

export function normalizeOutboxLimit(value: string | null | undefined): number {
  if (!value) return 10;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return 10;
  return Math.min(parsed, OUTBOX_MAX_BATCH);
}

export type OutboxTx = Prisma.TransactionClient;

export async function enqueueOutboxTx(
  tx: OutboxTx,
  input: { kind: string; dedupeKey: string; payload: Prisma.InputJsonValue; availableAt?: Date },
): Promise<void> {
  try {
    await tx.outboxJob.create({ data: input });
  } catch (error) {
    // A duplicate delivery is already represented by the durable job. This
    // makes enqueue idempotent while preserving the transaction's financial
    // semantics; any other database error must abort the parent transaction.
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
}

export async function enqueueOrderConfirmationTx(
  tx: OutboxTx,
  input: { eventId: string; buyerEmail: string; artworkTitle: string; amountCents: number },
): Promise<void> {
  await enqueueOutboxTx(tx, {
    kind: OUTBOX_ORDER_CONFIRMATION,
    dedupeKey: `order-confirmation:${input.eventId}`,
    payload: input as unknown as Prisma.InputJsonValue,
  });
}

/**
 * Small worker boundary. Claiming is a DB state transition; provider work is
 * performed after the claim, so a crashed process leaves a retryable job
 * rather than rolling back an already-paid order.
 */
export async function processOutboxBatch(limit = 10): Promise<{ processed: number; failed: number }> {
  const staleBefore = new Date(Date.now() - 5 * 60_000);
  // A worker can die after claiming a job. Reclaim only old PROCESSING rows so
  // two healthy workers never process the same job concurrently.
  await prisma.outboxJob.updateMany({
    where: { status: "PROCESSING", lockedAt: { lt: staleBefore } },
    data: { status: "PENDING", lockedAt: null, availableAt: new Date() },
  });
  // A worker may die after its final attempt. Do not leave that job looking
  // pending forever; make the terminal state explicit for operators.
  await prisma.outboxJob.updateMany({
    where: { status: "PENDING", attempts: { gte: 5 } },
    data: { status: "FAILED", lockedAt: null, lastError: "retry limit exhausted" },
  });
  const jobs = await prisma.outboxJob.findMany({
    where: { status: "PENDING", availableAt: { lte: new Date() }, attempts: { lt: 5 } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, OUTBOX_MAX_BATCH)),
  });
  let processed = 0;
  let failed = 0;
  for (const job of jobs) {
    const claimed = await prisma.outboxJob.updateMany({
      where: { id: job.id, status: "PENDING" },
      data: { status: "PROCESSING", lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue;
    try {
      if (job.kind === OUTBOX_ORDER_CONFIRMATION) {
        const payload = job.payload as { buyerEmail: string; artworkTitle: string; amountCents: number };
        await sendOrderConfirmationEmail(payload);
      } else {
        throw new Error(`unknown outbox job kind: ${job.kind}`);
      }
      await prisma.outboxJob.update({ where: { id: job.id }, data: { status: "COMPLETED", processedAt: new Date(), lockedAt: null } });
      processed += 1;
    } catch (error) {
      const exhausted = job.attempts >= 4;
      await prisma.outboxJob.update({ where: { id: job.id }, data: { status: exhausted ? "FAILED" : "PENDING", availableAt: new Date(Date.now() + 30_000), lockedAt: null, lastError: String(error) } });
      failed += 1;
    }
  }
  return { processed, failed };
}
