// app/api/impact/route.ts (GET) has no auth dependency — a public impact-
// totals endpoint. Two rules worth confirming: totals only ever sum
// Payout rows with status: "RELEASED" (a PENDING payout must not count),
// and piecesSold only counts Artwork rows with inventoryState: "SOLD".
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/impact/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createOrder(artworkId: string, amountCents: number) {
  return prisma.order.create({
    data: {
      artworkId,
      buyerEmail: "buyer@example.com",
      shippingName: "Test Buyer",
      shippingAddressLine1: "123 Test St",
      shippingCity: "Nairobi",
      shippingRegion: "Nairobi",
      shippingPostalCode: "00100",
      shippingCountry: "Kenya",
      amountCents,
      status: "PAID",
    },
  });
}

test("impact totals only sum RELEASED payouts, and piecesSold only counts SOLD artwork", async (t) => {
  const id = unique();

  // Baseline reads before creating any fixtures, so this test proves an
  // actual delta rather than re-deriving the same filter the route uses.
  const baselinePiecesSold = await prisma.artwork.count({ where: { inventoryState: "SOLD" } });
  const baselineArtistCents =
    (await prisma.payout.aggregate({ where: { status: "RELEASED", recipientType: "ARTIST" }, _sum: { amountCents: true } }))._sum
      .amountCents ?? 0;

  const artist = await prisma.artist.create({
    data: {
      slug: `test-impact-artist-${id}`,
      name: "Test Impact Artist",
      country: "Kenya",
      bio: "A throwaway artist created by impact.test.ts",
      imageUrl: "https://example.com/artist.jpg",
    },
  });
  const campaign = await prisma.campaign.create({
    data: {
      slug: `test-impact-campaign-${id}`,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
    },
  });
  const soldArtwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: "Sold Artwork",
      kind: "ORIGINAL",
      priceCents: 100000,
      imageUrl: "https://example.com/artwork.jpg",
      altText: "A throwaway sold artwork created by impact.test.ts",
      inventoryState: "SOLD",
    },
  });
  const availableArtwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: "Available Artwork",
      kind: "PRINT",
      priceCents: 5000,
      imageUrl: "https://example.com/artwork2.jpg",
      altText: "A throwaway available artwork created by impact.test.ts",
      inventoryState: "AVAILABLE",
    },
  });
  const releasedOrder = await createOrder(soldArtwork.id, 100000);
  const pendingOrder = await createOrder(soldArtwork.id, 50000);
  const releasedPayout = await prisma.payout.create({
    data: { orderId: releasedOrder.id, recipientType: "ARTIST", recipientId: artist.id, amountCents: 50000, status: "RELEASED" },
  });
  const pendingPayout = await prisma.payout.create({
    data: { orderId: pendingOrder.id, recipientType: "ARTIST", recipientId: artist.id, amountCents: 25000, status: "PENDING" },
  });

  t.after(async () => {
    await prisma.payout.delete({ where: { id: releasedPayout.id } });
    await prisma.payout.delete({ where: { id: pendingPayout.id } });
    await prisma.order.delete({ where: { id: releasedOrder.id } });
    await prisma.order.delete({ where: { id: pendingOrder.id } });
    await prisma.artwork.delete({ where: { id: soldArtwork.id } });
    await prisma.artwork.delete({ where: { id: availableArtwork.id } });
    await prisma.campaign.delete({ where: { id: campaign.id } });
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(
    body.totals.artistCents,
    baselineArtistCents + 50000,
    "only the RELEASED payout's amount (50000) should be added, not the PENDING one (25000)",
  );
  assert.equal(body.piecesSold, baselinePiecesSold + 1, "piecesSold must count the SOLD artwork but not the AVAILABLE one");
});
