import { prisma } from "@/lib/prisma";

// Postgres-backed sliding-window limiter — every worker process (see
// server.cluster.js) shares the same database, so this stays correct
// regardless of which worker handles which request. One row per hit;
// checking and cleaning up old rows both scope to the same key, so this
// self-maintains without a separate cleanup job.
export async function isRateLimited(key: string, maxHits: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  // Serialize work for this one key before counting. A transaction by itself
  // is not sufficient at Postgres's default READ COMMITTED isolation level:
  // concurrent transactions can each observe the same count and all insert a
  // hit. An advisory *transaction* lock is released automatically at commit
  // or rollback, applies across every Node worker, and keeps unrelated keys
  // fully concurrent.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`;

    // Pruned first so a key that's gone quiet doesn't accumulate rows
    // forever — cheap, since it's scoped to this one key.
    await tx.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

    const count = await tx.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
    if (count >= maxHits) {
      return true;
    }

    await tx.rateLimitHit.create({ data: { key } });
    return false;
  });
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
