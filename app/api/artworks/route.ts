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
    include: {
      campaign: {
        include: { animal: true, artist: true },
      },
    },
  });

  return NextResponse.json({ artworks });
}
