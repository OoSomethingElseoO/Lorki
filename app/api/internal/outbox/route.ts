import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { normalizeOutboxLimit, OUTBOX_MAX_BACKLOG, processOutboxBatch } from "@/lib/outbox";
import { prisma } from "@/lib/prisma";
import { apiContractError } from "@/lib/api-contract";

/**
 * Private worker boundary. Invoke from a scheduler/worker with
 * OUTBOX_WORKER_SECRET; never expose this as a public browser endpoint.
 */
export async function POST(request: Request) {
  const expected = process.env.OUTBOX_WORKER_SECRET;
  const received = request.headers.get("x-outbox-worker-secret");
  const expectedBytes = expected ? Buffer.from(expected) : null;
  const receivedBytes = received ? Buffer.from(received) : null;
  const valid = Boolean(expectedBytes && receivedBytes && expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes));
  if (!valid) {
    return apiContractError("UNAUTHORIZED", "Unauthorized", 401);
  }
  // Backpressure is deliberate: if the scheduler is misconfigured or the
  // provider is down, never let an internal trigger enqueue an unbounded
  // amount of work in one request. Existing jobs remain durable and can be
  // retried after the operator resolves the dependency failure.
  const backlog = await prisma.outboxJob.count({ where: { status: { in: ["PENDING", "PROCESSING"] } } });
  if (backlog >= OUTBOX_MAX_BACKLOG) {
    const response = apiContractError("RATE_LIMITED", "Outbox backlog is above the safety limit", 429, { backlog });
    response.headers.set("retry-after", "30");
    return response;
  }
  const limit = normalizeOutboxLimit(new URL(request.url).searchParams.get("limit"));
  const result = await processOutboxBatch(limit);
  return NextResponse.json(result);
}
