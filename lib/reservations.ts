import { prisma } from "@/lib/prisma";

export const RESERVATION_TTL_MS = 30 * 60 * 1000;

// Originals stuck RESERVED from an abandoned checkout go back on sale once
// the reservation is older than the TTL. Called lazily on read paths rather
// than via a scheduled job, since a stale reservation only matters the next
// time someone looks at the artwork.
export async function releaseExpiredReservations() {
  const cutoff = new Date(Date.now() - RESERVATION_TTL_MS);

  await prisma.artwork.updateMany({
    where: {
      inventoryState: "RESERVED",
      reservedAt: { lt: cutoff },
    },
    data: {
      inventoryState: "AVAILABLE",
      reservedAt: null,
    },
  });
}
