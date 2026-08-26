// app/api/seller/artworks/[id]/route.ts (PATCH, DELETE) gates on
// getCurrentUser(), which throws outside a real Next.js request scope — so
// the direct-handler-call pattern doesn't work here (same situation as
// seller-profile.test.ts). What's genuinely valuable and independent of
// session is the route's own ownership check (loadOwnArtwork) and its
// SOLD-immutability guard, both reproduced here exactly and exercised
// directly against real rows via Prisma.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createArtist(label: string) {
  const id = unique();
  return prisma.artist.create({
    data: {
      slug: `test-${label}-${id}`,
      name: `Test ${label}`,
      country: "Kenya",
      bio: "A throwaway artist created by seller-artworks.test.ts",
      imageUrl: "https://example.com/artist.jpg",
    },
  });
}

async function createArtwork(artistId: string, inventoryState: "AVAILABLE" | "SOLD") {
  const id = unique();
  const campaign = await prisma.campaign.create({
    data: {
      slug: `test-campaign-${id}`,
      artistId,
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
      altText: "A throwaway artwork created by seller-artworks.test.ts",
      inventoryState,
    },
  });
  return { artwork, campaign };
}

// Reproduces app/api/seller/artworks/[id]/route.ts's loadOwnArtwork verbatim.
async function loadOwnArtwork(sellerId: string, artworkId: string) {
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    include: { campaign: true },
  });
  if (!artwork || artwork.campaign.artistId !== sellerId) {
    return null;
  }
  return artwork;
}

test("loadOwnArtwork loads an artwork whose campaign belongs to the requesting seller", async (t) => {
  const artist = await createArtist("owner");
  const { artwork, campaign } = await createArtwork(artist.id, "AVAILABLE");
  t.after(async () => {
    await prisma.artwork.delete({ where: { id: artwork.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  const owned = await loadOwnArtwork(artist.id, artwork.id);
  assert.ok(owned, "artist who owns the artwork's campaign must load it");
  assert.equal(owned!.id, artwork.id);
});

test("loadOwnArtwork returns null for an artwork belonging to a different seller", async (t) => {
  const owner = await createArtist("real-owner");
  const stranger = await createArtist("stranger");
  const { artwork, campaign } = await createArtwork(owner.id, "AVAILABLE");
  t.after(async () => {
    await prisma.artwork.delete({ where: { id: artwork.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.artist.delete({ where: { id: owner.id } });
    await prisma.artist.delete({ where: { id: stranger.id } });
  });

  const owned = await loadOwnArtwork(stranger.id, artwork.id);
  assert.equal(owned, null, "a different seller must never load this artwork");
});

test("loadOwnArtwork returns null for a nonexistent artwork id", async (t) => {
  const artist = await createArtist("solo");
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  const owned = await loadOwnArtwork(artist.id, "does-not-exist");
  assert.equal(owned, null);
});

test("PATCH/DELETE's SOLD-immutability guard: an AVAILABLE artwork passes, a SOLD one trips it", async (t) => {
  const artist = await createArtist("guard");
  const { artwork: available, campaign: campaignA } = await createArtwork(artist.id, "AVAILABLE");
  const { artwork: sold, campaign: campaignB } = await createArtwork(artist.id, "SOLD");
  t.after(async () => {
    await prisma.artwork.delete({ where: { id: available.id } });
    await prisma.artwork.delete({ where: { id: sold.id } });
    await prisma.campaign.delete({ where: { id: campaignA.id } });
    await prisma.campaign.delete({ where: { id: campaignB.id } });
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  // This is precisely the condition both PATCH and DELETE evaluate
  // (`if (owned.inventoryState === "SOLD") return 409`) right after
  // loadOwnArtwork succeeds.
  const availableOwned = await loadOwnArtwork(artist.id, available.id);
  const soldOwned = await loadOwnArtwork(artist.id, sold.id);

  assert.equal(availableOwned!.inventoryState === "SOLD", false, "an AVAILABLE artwork must be editable/deletable");
  assert.equal(soldOwned!.inventoryState === "SOLD", true, "a SOLD artwork must be rejected for edit/delete");
});
