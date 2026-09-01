import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// max caps how many concurrent connections this one process can open to
// Postgres — unset, node-postgres has no ceiling of its own, so a burst of
// concurrent requests (e.g. many checkouts at once) could open far more
// connections than the database's own max_connections actually allows,
// failing requests instead of just queueing them for a free connection.
// 10 assumes a single web process; raise it (and check the DB plan's own
// limit) if this ever runs as multiple instances behind a load balancer.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 10 });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
