import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// max caps how many concurrent connections this one process can open to
// Postgres — unset, node-postgres has no ceiling of its own, so a burst of
// concurrent requests (e.g. many checkouts at once) could open far more
// connections than the database's own max_connections actually allows,
// failing requests instead of just queueing them for a free connection.
// The pool is per Node process. In clustered mode the effective connection
// ceiling is DATABASE_POOL_MAX * WEB_CONCURRENCY, so keep the value explicit
// and bounded instead of silently multiplying a hardcoded pool across workers.
// Keep the default conservative for serverless/clustered deployments and
// hosted Postgres (where every worker gets its own pool). Operators can raise
// DATABASE_POOL_MAX deliberately when their database budget supports it.
const configuredPoolMax = Number(process.env.DATABASE_POOL_MAX ?? "5");
const poolMax = Number.isInteger(configuredPoolMax) && configuredPoolMax >= 1
  ? Math.min(configuredPoolMax, 50)
  : 5;
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  max: poolMax,
  // Neon can briefly queue a connection during bursts. Fail only after a
  // bounded wait long enough for the pool/transaction retry policy to work.
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
