// Shared Prisma access + fixture builders for the Playwright E2E suite.
//
// This talks directly to the same local dev Postgres the running app uses
// (DATABASE_URL from .env — never production, see the repo's own
// lib/prisma.ts) so tests can seed preconditions ("Given...") and assert
// on outcomes ("Then...") that the UI alone can't easily confirm (e.g. a
// DB column flipping), the same way lib/__tests__/reservations.test.ts
// does for its own Node-test-runner-level tests.
//
// Every row created here is tagged with a unique "e2e-<label>-<ts>-<rand>"
// value used as the slug/email/title, and every fixture returns a
// cleanup() that deletes exactly what it created, in FK-safe order. Tests
// call cleanup() via the fixtures in test-fixtures.ts, so cleanup runs
// even when a test fails partway through.
import "dotenv/config";
import { PrismaClient, type ArtworkKind, type InquiryStatus, type InventoryState, type PayoutStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });

// Same fallback the app's own seed script documents — verified against the
// real .env in this repo (ADMIN_EMAIL/ADMIN_PASSWORD), not guessed.
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "change-me";

function uniqueSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function testTag(label: string): string {
  return `e2e-${label}-${uniqueSuffix()}`;
}

type OriginalArtworkOptions = {
  inventoryState?: InventoryState;
  reservedAt?: Date | null;
  withInquiry?: { name: string; email: string; status?: InquiryStatus };
};

// Builds a throwaway Conservancy -> Artist -> Campaign(LIVE) -> Artwork
// chain, mirroring the shape prisma/seed.ts creates for the real featured
// piece, so the artwork behaves exactly like a real ORIGINAL on the
// storefront (campaign.status must be LIVE for /originals and the artist
// page to list it at all — see lib/storefront.ts).
export async function createOriginalArtworkFixture(options: OriginalArtworkOptions = {}) {
  const tag = testTag("original");

  const conservancy = await prisma.conservancy.create({
    data: {
      name: `E2E Test Conservancy ${tag}`,
      region: "Test Region",
      mission: "Throwaway conservancy created by the Playwright E2E suite.",
      website: "https://example.com",
      contactEmail: `${tag}-conservancy@e2e.test`,
    },
  });

  const artist = await prisma.artist.create({
    data: {
      slug: tag,
      name: `E2E Test Artist ${tag}`,
      country: "Kenya",
      bio: "Throwaway artist created by the Playwright E2E suite.",
      imageUrl: "https://example.com/artist.jpg",
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      slug: tag,
      artistId: artist.id,
      conservancyId: conservancy.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
      status: "LIVE",
    },
  });

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: `E2E Test Original ${tag}`,
      kind: "ORIGINAL" as ArtworkKind,
      priceCents: 250_000,
      imageUrl: "https://example.com/artwork.jpg",
      altText: "Throwaway artwork created by the Playwright E2E suite.",
      inventoryState: options.inventoryState ?? "AVAILABLE",
      reservedAt: options.reservedAt ?? null,
    },
  });

  const inquiry = options.withInquiry
    ? await prisma.inquiry.create({
        data: {
          artworkId: artwork.id,
          name: options.withInquiry.name,
          email: options.withInquiry.email,
          status: options.withInquiry.status ?? "NEW",
        },
      })
    : null;

  async function cleanup() {
    await prisma.inquiry.deleteMany({ where: { artworkId: artwork.id } });
    await prisma.artwork.delete({ where: { id: artwork.id } }).catch(() => {});
    await prisma.campaign.delete({ where: { id: campaign.id } }).catch(() => {});
    await prisma.artist.delete({ where: { id: artist.id } }).catch(() => {});
    await prisma.conservancy.delete({ where: { id: conservancy.id } }).catch(() => {});
  }

  return { tag, artwork, campaign, artist, conservancy, inquiry, cleanup };
}

type FailedPayoutOptions = {
  payoutStatus?: PayoutStatus;
};

// Builds a throwaway Artist -> Campaign -> Artwork -> Order -> Payout
// chain with the Payout already in the given status (FAILED by default).
// There's no UI path to create a FAILED payout directly (it only ever
// happens via a refund/chargeback clawback — see lib/refunds.ts and the
// Stripe webhook), so this seeds it the same way any E2E fixture seeds
// hard-to-reach preconditions: straight through Prisma.
export async function createFailedPayoutFixture(options: FailedPayoutOptions = {}) {
  const tag = testTag("payout");

  const artist = await prisma.artist.create({
    data: {
      slug: tag,
      name: `E2E Test Artist ${tag}`,
      country: "Kenya",
      bio: "Throwaway artist created by the Playwright E2E suite.",
      imageUrl: "https://example.com/artist.jpg",
      // MANUAL (the default) is deliberate: it makes attemptAutomaticPayout
      // a no-op on revive, so this test never attempts a real Flutterwave
      // or Stripe Connect transfer.
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      slug: tag,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
    },
  });

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: `E2E Test Print ${tag}`,
      kind: "PRINT" as ArtworkKind,
      priceCents: 9_500,
      imageUrl: "https://example.com/artwork.jpg",
      altText: "Throwaway artwork created by the Playwright E2E suite.",
    },
  });

  const buyerEmail = `${tag}@e2e.test`;

  const order = await prisma.order.create({
    data: {
      artworkId: artwork.id,
      buyerEmail,
      shippingName: "E2E Test Buyer",
      shippingAddressLine1: "1 Test Street",
      shippingCity: "Testville",
      shippingRegion: "Test Region",
      shippingPostalCode: "00000",
      shippingCountry: "Kenya",
      amountCents: 9_500,
      // A lost chargeback is the real-world cause of a FAILED payout (see
      // the revive route's own comment) — REFUNDED is the closest existing
      // OrderStatus to that outcome. The revive route itself never reads
      // order.status, so this is for fixture realism only.
      status: "REFUNDED",
    },
  });

  const payout = await prisma.payout.create({
    data: {
      orderId: order.id,
      recipientType: "ARTIST",
      recipientId: artist.id,
      amountCents: 4_750,
      status: options.payoutStatus ?? "FAILED",
      releasedAt: options.payoutStatus === "RELEASED" ? new Date() : null,
    },
  });

  async function cleanup() {
    await prisma.payout.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } }).catch(() => {});
    await prisma.artwork.delete({ where: { id: artwork.id } }).catch(() => {});
    await prisma.campaign.delete({ where: { id: campaign.id } }).catch(() => {});
    await prisma.artist.delete({ where: { id: artist.id } }).catch(() => {});
  }

  return { tag, artist, campaign, artwork, order, payout, buyerEmail, cleanup };
}
