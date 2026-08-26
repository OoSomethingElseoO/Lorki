// Unlike the app itself (Next.js loads .env automatically) or the Prisma
// CLI (prisma.config.ts does `import "dotenv/config"`), a plain `tsx --test`
// run has nothing loading .env for it — this is the first test file that
// needs a live DB connection, so it has to do that itself. dotenv is
// already a project dependency (see prisma.config.ts), not a new one.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { RESERVATION_TTL_MS, releaseExpiredReservations, releaseReservationIfHeld } from "@/lib/reservations";

// These hit the real local dev database via Prisma (no mocking) — the
// reservation functions are DB-driven side effects, not pure logic. Every
// test creates its own throwaway Artist -> Campaign -> Artwork chain with a
// unique slug (so parallel/re-runs never collide) and tears every row down
// via t.after(), including on failure, so nothing is left behind.

async function createArtwork(t: import("node:test").TestContext, overrides: { inventoryState: "AVAILABLE" | "RESERVED" | "SOLD"; reservedAt?: Date | null }) {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const artist = await prisma.artist.create({
    data: {
      slug: `test-artist-${unique}`,
      name: "Test Artist",
      country: "Kenya",
      bio: "A throwaway artist created by reservations.test.ts",
      imageUrl: "https://example.com/artist.jpg",
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      slug: `test-campaign-${unique}`,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
    },
  });

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: "Test Artwork",
      kind: "ORIGINAL",
      priceCents: 10000,
      imageUrl: "https://example.com/artwork.jpg",
      altText: "A throwaway artwork created by reservations.test.ts",
      inventoryState: overrides.inventoryState,
      reservedAt: overrides.reservedAt ?? null,
    },
  });

  t.after(async () => {
    await prisma.artwork.delete({ where: { id: artwork.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  return artwork;
}

test("releaseExpiredReservations releases a reservation older than the TTL", async (t) => {
  const expiredAt = new Date(Date.now() - RESERVATION_TTL_MS - 60_000);
  const artwork = await createArtwork(t, { inventoryState: "RESERVED", reservedAt: expiredAt });

  await releaseExpiredReservations();

  const updated = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
  assert.equal(updated.inventoryState, "AVAILABLE");
  assert.equal(updated.reservedAt, null);
});

test("releaseExpiredReservations leaves a fresh reservation alone", async (t) => {
  const freshAt = new Date();
  const artwork = await createArtwork(t, { inventoryState: "RESERVED", reservedAt: freshAt });

  await releaseExpiredReservations();

  const updated = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
  assert.equal(updated.inventoryState, "RESERVED");
  assert.equal(updated.reservedAt?.getTime(), freshAt.getTime());
});

test("releaseReservationIfHeld releases a RESERVED artwork", async (t) => {
  const artwork = await createArtwork(t, { inventoryState: "RESERVED", reservedAt: new Date() });

  await releaseReservationIfHeld(artwork.id);

  const updated = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
  assert.equal(updated.inventoryState, "AVAILABLE");
  assert.equal(updated.reservedAt, null);
});

test("releaseReservationIfHeld is a no-op on a SOLD artwork — must never undo a sale", async (t) => {
  const artwork = await createArtwork(t, { inventoryState: "SOLD" });

  await releaseReservationIfHeld(artwork.id);

  const updated = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
  assert.equal(updated.inventoryState, "SOLD", "a SOLD artwork must stay SOLD");
});

test("releaseReservationIfHeld is a no-op on an already-AVAILABLE artwork", async (t) => {
  const artwork = await createArtwork(t, { inventoryState: "AVAILABLE" });

  await releaseReservationIfHeld(artwork.id);

  const updated = await prisma.artwork.findUniqueOrThrow({ where: { id: artwork.id } });
  assert.equal(updated.inventoryState, "AVAILABLE");
  assert.equal(updated.reservedAt, null);
});
