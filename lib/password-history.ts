import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const HISTORY_LIMIT = 10;

export async function passwordWasRecentlyUsed(userId: string, password: string): Promise<boolean> {
  const recent = await prisma.passwordHistory.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_LIMIT,
    select: { passwordHash: true },
  });
  for (const entry of recent) if (await verifyPassword(password, entry.passwordHash)) return true;
  return false;
}

export async function recordPasswordHistory(userId: string, passwordHash: string): Promise<void> {
  await prisma.passwordHistory.create({ data: { userId, passwordHash } });
  const stale = await prisma.passwordHistory.findMany({
    where: { userId }, orderBy: { createdAt: "desc" }, skip: HISTORY_LIMIT, select: { id: true },
  });
  if (stale.length) await prisma.passwordHistory.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
}
