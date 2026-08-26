import { prisma } from "@/lib/prisma";

export const RESERVATION_TTL_MS = 30 * 60 * 1000;

// Originals get RESERVED the moment someone submits an inquiry (see
// /api/inquiries) and stay that way — invisible to other buyers — until
// either an admin records the resulting sale or the reservation goes
// stale. This releases the stale ones back to AVAILABLE. Called lazily on
// read paths rather than via a scheduled job, since a stale reservation
// only matters the next time someone looks at the artwork.
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

// The immediate counterpart to the TTL-based release above: an admin
// marking an inquiry CLOSED (buyer declined, went cold, whatever) is a
// definite "this isn't turning into a sale" signal — there's no reason to
// make the piece wait out the rest of the 30-minute hold once that's
// known. Guarded on the piece still being RESERVED (not unconditionally
// AVAILABLE) so this can never undo a SOLD state — if the admin instead
// recorded the resulting cash sale first and closes the inquiry after,
// this is correctly a no-op.
export async function releaseReservationIfHeld(artworkId: string) {
  await prisma.artwork.updateMany({
    where: { id: artworkId, inventoryState: "RESERVED" },
    data: { inventoryState: "AVAILABLE", reservedAt: null },
  });
}
