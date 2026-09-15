import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================================================
// IDEMPOTENCY KEY EXTRACTION
// ============================================================================

export const getIdempotencyKey = (request: Request): string | null => {
  return request.headers.get("Idempotency-Key");
};

// ============================================================================
// IDEMPOTENCY CHECK
// ============================================================================

// Returns cached response if request was already processed, null if first time.
// Usage:
//   const cached = await checkIdempotency(request, userId);
//   if (cached) return cached;
//   // ... do the actual work ...
//   await storeIdempotencyResponse(idempotencyKey, userId, status, body);
export const checkIdempotency = async (
  request: Request,
  userId?: string
): Promise<NextResponse | null> => {
  const idempotencyKey = getIdempotencyKey(request);

  // No key = not using idempotency, proceed normally
  if (!idempotencyKey) {
    return null;
  }

  const userIdValue = userId ?? null;
  const stored = await prisma.idempotencyStore.findUnique({
    where: {
      idempotencyKey_userId: {
        idempotencyKey: idempotencyKey as string,
        userId: userIdValue,
      } as any,
    },
  });

  if (stored) {
    // Clean up old entries while we're here
    cleanupOldIdempotencyRecords().catch((e) =>
      console.error("[idempotency:cleanup-failed]", e)
    );

    return NextResponse.json(stored.responseBody, { status: stored.responseStatus });
  }

  return null;
};

// ============================================================================
// IDEMPOTENCY RESPONSE STORAGE
// ============================================================================

export const storeIdempotencyResponse = async (
  idempotencyKey: string,
  userId: string | undefined,
  status: number,
  body: unknown
): Promise<void> => {
  const userIdValue = userId ?? null;
  await prisma.idempotencyStore.upsert({
    where: {
      idempotencyKey_userId: {
        idempotencyKey: idempotencyKey as string,
        userId: userIdValue,
      } as any,
    },
    create: {
      idempotencyKey: idempotencyKey as string,
      userId: userIdValue,
      responseStatus: status,
      responseBody: body as any,
    },
    update: {
      responseStatus: status,
      responseBody: body as any,
    },
  });
};

// ============================================================================
// CLEANUP
// ============================================================================

export const cleanupOldIdempotencyRecords = async (): Promise<void> => {
  const cutoff = new Date(Date.now() - IDEMPOTENCY_TTL_MS);
  await prisma.idempotencyStore.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });
};
