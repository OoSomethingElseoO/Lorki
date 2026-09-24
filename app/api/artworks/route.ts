import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/reservations";

export async function GET(request: Request) {
  await releaseExpiredReservations();

  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind");

  const artworks = await prisma.artwork.findMany({
    where: {
      campaign: { status: "LIVE" },
      inventoryState: "AVAILABLE",
      ...(kind === "ORIGINAL" || kind === "PRINT" ? { kind } : {}),
    },
    // This is a public storefront endpoint. Select the presentation contract
    // explicitly: spreading full Artist/Campaign records would expose payout
    // accounts and connected-payment identifiers to unauthenticated visitors.
    select: {
      id: true,
      title: true,
      kind: true,
      priceCents: true,
      currency: true,
      imageUrl: true,
      altText: true,
      story: true,
      inventoryState: true,
      campaign: {
        select: {
          id: true,
          slug: true,
          animal: { select: { id: true, slug: true, name: true, species: true, region: true, story: true, imageUrl: true } },
          artist: { select: { id: true, slug: true, name: true, country: true, bio: true, imageUrl: true } },
        },
      },
    },
  });

  return NextResponse.json({ artworks });
}
