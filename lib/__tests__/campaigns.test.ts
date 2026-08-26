// app/api/campaigns/route.ts (GET) has no auth dependency at all — a
// public listing endpoint. The one rule worth confirming is the `where`
// filter: only status: "LIVE" campaigns are ever returned.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET } from "@/app/api/campaigns/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

test("GET only returns LIVE campaigns, never a DRAFT one", async (t) => {
  const id = unique();
  const artist = await prisma.artist.create({
    data: {
      slug: `test-campaigns-artist-${id}`,
      name: "Test Campaigns Artist",
      country: "Kenya",
      bio: "A throwaway artist created by campaigns.test.ts",
      imageUrl: "https://example.com/artist.jpg",
    },
  });
  const liveCampaign = await prisma.campaign.create({
    data: {
      slug: `test-live-campaign-${id}`,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
      status: "LIVE",
    },
  });
  const draftCampaign = await prisma.campaign.create({
    data: {
      slug: `test-draft-campaign-${id}`,
      artistId: artist.id,
      artistPercent: 50,
      conservancyPercent: 25,
      operationsPercent: 25,
      status: "DRAFT",
    },
  });
  t.after(async () => {
    await prisma.campaign.delete({ where: { id: liveCampaign.id } });
    await prisma.campaign.delete({ where: { id: draftCampaign.id } });
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.ok(body.campaigns.some((c: { id: string }) => c.id === liveCampaign.id), "the LIVE campaign must be included");
  assert.ok(!body.campaigns.some((c: { id: string }) => c.id === draftCampaign.id), "the DRAFT campaign must not be included");
});
