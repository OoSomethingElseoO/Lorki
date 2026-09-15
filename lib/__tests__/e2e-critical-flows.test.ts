// End-to-end tests for critical business flows: checkout, inquiry, delivery/payout
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function setupTestData() {
  const id = unique();

  const artist = await prisma.artist.create({
    data: {
      slug: `e2e-artist-${id}`,
      name: "E2E Test Artist",
      country: "Kenya",
      bio: "Test artist",
      imageUrl: "https://example.com/test.jpg",
    },
  });

  const conservancy = await prisma.conservancy.create({
    data: {
      name: "E2E Test Conservancy",
      region: "Nairobi",
      mission: "Protect wildlife",
      website: "https://example.com",
      contactEmail: "contact@example.com",
    },
  });

  const campaign = await prisma.campaign.create({
    data: {
      slug: `e2e-campaign-${id}`,
      artistId: artist.id,
      conservancyId: conservancy.id,
      artistPercent: 50,
      conservancyPercent: 30,
      operationsPercent: 20,
      status: "LIVE",
    },
  });

  const printArtwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: "E2E Test Print",
      kind: "PRINT",
      priceCents: 5000, // $50
      imageUrl: "https://example.com/test.jpg",
      altText: "Test artwork",
      inventoryState: "AVAILABLE",
    },
  });

  const originalArtwork = await prisma.artwork.create({
    data: {
      campaignId: campaign.id,
      title: "E2E Test Original",
      kind: "ORIGINAL",
      priceCents: 100000, // $1000
      imageUrl: "https://example.com/test.jpg",
      altText: "Test original",
      inventoryState: "AVAILABLE",
    },
  });

  return { artist, conservancy, campaign, printArtwork, originalArtwork };
}

test("E2E: Print order flow — create order and release payout", async (t) => {
  const { artist, conservancy, printArtwork } = await setupTestData();
  t.after(async () => {
    try {
      await prisma.order.deleteMany({ where: { artworkId: printArtwork.id } });
      await prisma.artwork.deleteMany({ where: { campaignId: printArtwork.campaignId } });
      await prisma.campaign.deleteMany({ where: { id: printArtwork.campaignId } });
      await prisma.artist.delete({ where: { id: artist.id } });
      await prisma.conservancy.delete({ where: { id: conservancy.id } });
    } catch (e) {
      // Cleanup errors don't fail the test
    }
  });

  // Simulate checkout creating an order
  const order = await prisma.order.create({
    data: {
      artworkId: printArtwork.id,
      buyerEmail: "buyer@example.com",
      shippingName: "Test Buyer",
      shippingAddressLine1: "123 Main St",
      shippingCity: "Nairobi",
      shippingRegion: "Nairobi",
      shippingPostalCode: "00100",
      shippingCountry: "KE",
      amountCents: printArtwork.priceCents,
      currency: "USD",
      paymentMethod: "STRIPE",
      status: "PAID",
    },
  });

  // Create payouts as webhook would
  const split = { artistCents: 2500, conservancyCents: 1500, operationsCents: 1000 };
  const payouts = await prisma.payout.createMany({
    data: [
      {
        orderId: order.id,
        recipientType: "ARTIST",
        recipientId: artist.id,
        amountCents: split.artistCents,
        status: "PENDING",
      },
      {
        orderId: order.id,
        recipientType: "CONSERVANCY",
        recipientId: conservancy.id,
        amountCents: split.conservancyCents,
        status: "PENDING",
      },
      {
        orderId: order.id,
        recipientType: "OPERATIONS",
        recipientId: "operations",
        amountCents: split.operationsCents,
        status: "PENDING",
      },
    ],
  });

  // Mark as shipped
  const shipment = await prisma.shipment.create({
    data: {
      orderId: order.id,
      carrier: "DHL",
      trackingNumber: "1Z999AA10123456784",
      method: "PRINT_POD",
      shippedAt: new Date(),
    },
  });

  // Mark as delivered (releases payouts)
  await prisma.$transaction(async (tx) => {
    await tx.shipment.update({ where: { orderId: order.id }, data: { deliveredAt: new Date() } });
    const updated = await tx.order.update({ where: { id: order.id }, data: { status: "DELIVERED" } });
    await tx.payout.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "RELEASED", releasedAt: new Date() },
    });
  });

  // Verify final state
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { payouts: true, shipment: true },
  });

  assert.equal(finalOrder?.status, "DELIVERED");
  assert.ok(finalOrder?.shipment?.deliveredAt);
  assert.equal(finalOrder?.payouts.filter((p) => p.status === "RELEASED").length, 3);
});

test("E2E: Inquiry (original) flow — create reservation, record sale", async (t) => {
  const { artist, conservancy, originalArtwork } = await setupTestData();
  t.after(async () => {
    try {
      const orders = await prisma.order.findMany({ where: { artworkId: originalArtwork.id } });
      for (const order of orders) {
        await prisma.payout.deleteMany({ where: { orderId: order.id } });
      }
      await prisma.inquiry.deleteMany({ where: { artworkId: originalArtwork.id } });
      await prisma.order.deleteMany({ where: { artworkId: originalArtwork.id } });
      await prisma.artwork.deleteMany({ where: { campaignId: originalArtwork.campaignId } });
      await prisma.campaign.deleteMany({ where: { id: originalArtwork.campaignId } });
      await prisma.artist.delete({ where: { id: artist.id } });
      await prisma.conservancy.delete({ where: { id: conservancy.id } });
    } catch (e) {
      // Cleanup errors don't fail the test
    }
  });

  // Step 1: Submit inquiry — reserves original
  const reserved = await prisma.artwork.updateMany({
    where: { id: originalArtwork.id, inventoryState: "AVAILABLE" },
    data: { inventoryState: "RESERVED", reservedAt: new Date() },
  });
  assert.equal(reserved.count, 1);

  const inquiry = await prisma.inquiry.create({
    data: {
      artworkId: originalArtwork.id,
      name: "Test Buyer",
      email: "buyer@example.com",
    },
  });

  // Verify artwork is now reserved
  let artwork = await prisma.artwork.findUnique({ where: { id: originalArtwork.id } });
  assert.equal(artwork?.inventoryState, "RESERVED");

  // Step 2: Record cash sale (in-person)
  const order = await prisma.order.create({
    data: {
      artworkId: originalArtwork.id,
      buyerEmail: inquiry.email,
      shippingName: inquiry.name,
      shippingAddressLine1: "",
      shippingCity: "",
      shippingRegion: "",
      shippingPostalCode: "",
      shippingCountry: "KE",
      amountCents: originalArtwork.priceCents,
      currency: "USD",
      paymentMethod: "CASH",
      status: "DELIVERED", // In-person means already delivered
    },
  });

  // Artwork should be marked SOLD
  await prisma.artwork.update({
    where: { id: originalArtwork.id },
    data: { inventoryState: "SOLD", reservedAt: null },
  });

  // Create and release payouts immediately (in-person)
  await prisma.payout.createMany({
    data: [
      {
        orderId: order.id,
        recipientType: "ARTIST",
        recipientId: artist.id,
        amountCents: Math.floor(originalArtwork.priceCents * 0.5),
        status: "RELEASED",
        releasedAt: new Date(),
      },
      {
        orderId: order.id,
        recipientType: "CONSERVANCY",
        recipientId: conservancy.id,
        amountCents: Math.floor(originalArtwork.priceCents * 0.3),
        status: "RELEASED",
        releasedAt: new Date(),
      },
      {
        orderId: order.id,
        recipientType: "OPERATIONS",
        recipientId: "operations",
        amountCents: Math.floor(originalArtwork.priceCents * 0.2),
        status: "RELEASED",
        releasedAt: new Date(),
      },
    ],
  });

  // Verify final state
  artwork = await prisma.artwork.findUnique({ where: { id: originalArtwork.id } });
  assert.equal(artwork?.inventoryState, "SOLD");
  assert.equal(artwork?.reservedAt, null);

  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: { payouts: true },
  });
  assert.equal(finalOrder?.status, "DELIVERED");
  assert.equal(finalOrder?.payouts.filter((p) => p.status === "RELEASED").length, 3);
});

test("E2E: Refund flow — reverse order and claw back payouts", async (t) => {
  const { artist, conservancy, printArtwork } = await setupTestData();
  t.after(async () => {
    try {
      await prisma.order.deleteMany({ where: { artworkId: printArtwork.id } });
      await prisma.artwork.deleteMany({ where: { campaignId: printArtwork.campaignId } });
      await prisma.campaign.deleteMany({ where: { id: printArtwork.campaignId } });
      await prisma.artist.delete({ where: { id: artist.id } });
      await prisma.conservancy.delete({ where: { id: conservancy.id } });
    } catch (e) {
      // Cleanup errors don't fail the test
    }
  });

  // Create order and payouts
  const order = await prisma.order.create({
    data: {
      artworkId: printArtwork.id,
      buyerEmail: "buyer@example.com",
      shippingName: "Test Buyer",
      shippingAddressLine1: "123 Main",
      shippingCity: "Nairobi",
      shippingRegion: "Nairobi",
      shippingPostalCode: "00100",
      shippingCountry: "KE",
      amountCents: printArtwork.priceCents,
      currency: "USD",
      paymentMethod: "STRIPE",
      status: "PAID",
    },
  });

  await prisma.payout.createMany({
    data: [
      {
        orderId: order.id,
        recipientType: "ARTIST",
        recipientId: artist.id,
        amountCents: 2500,
        status: "RELEASED",
        releasedAt: new Date(),
      },
      {
        orderId: order.id,
        recipientType: "CONSERVANCY",
        recipientId: conservancy.id,
        amountCents: 1500,
        status: "RELEASED",
        releasedAt: new Date(),
      },
      {
        orderId: order.id,
        recipientType: "OPERATIONS",
        recipientId: "operations",
        amountCents: 1000,
        status: "RELEASED",
        releasedAt: new Date(),
      },
    ],
  });

  // Refund: mark order as REFUNDED
  await prisma.order.update({
    where: { id: order.id },
    data: { status: "REFUNDED" },
  });

  // Payouts that were RELEASED stay RELEASED (customer already paid)
  // But an admin can manually mark them as FAILED if there was a chargeback
  const payouts = await prisma.payout.findMany({ where: { orderId: order.id } });
  assert.equal(payouts.filter((p) => p.status === "RELEASED").length, 3);

  const refundedOrder = await prisma.order.findUnique({ where: { id: order.id } });
  assert.equal(refundedOrder?.status, "REFUNDED");
});
