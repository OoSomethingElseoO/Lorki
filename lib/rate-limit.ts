import { prisma } from "@/lib/prisma";
import { withDatabaseRetry } from "@/lib/reliability";

// Keep a burst for the same key from opening one database transaction per
// request in this process. The database advisory lock below still protects
// across clustered workers; this local queue prevents a single worker from
// exhausting its pool before those transactions can reach the lock.
const localKeyQueues = new Map<string, Promise<void>>();

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
  const previous = localKeyQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => { release = resolve; });
  localKeyQueues.set(key, current);
  await previous.catch(() => undefined);

  try {
    return await withDatabaseRetry(() => prisma.$transaction(async (tx) => {
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
    }, {
      // A shared Neon connection can legitimately queue behind other requests
      // during a burst. Keep the transaction bounded, but do not use Prisma's
      // short default wait/timeout for this intentionally serialized section.
      maxWait: 10_000,
      timeout: 15_000,
    }));
  } finally {
    release();
    if (localKeyQueues.get(key) === current) localKeyQueues.delete(key);
  }
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
