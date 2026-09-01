import { prisma } from "@/lib/prisma";

// Postgres-backed sliding-window limiter — every worker process (see
// server.cluster.js) shares the same database, so this stays correct
// regardless of which worker handles which request. One row per hit;
// checking and cleaning up old rows both scope to the same key, so this
// self-maintains without a separate cleanup job.
export async function isRateLimited(key: string, maxHits: number, windowMs: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  // Pruned first so a key that's gone quiet doesn't accumulate rows
  // forever — cheap, since it's scoped to this one key.
  await prisma.rateLimitHit.deleteMany({ where: { key, createdAt: { lt: windowStart } } });

  const count = await prisma.rateLimitHit.count({ where: { key, createdAt: { gte: windowStart } } });
  if (count >= maxHits) {
    return true;
  }

  await prisma.rateLimitHit.create({ data: { key } });
  return false;
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
