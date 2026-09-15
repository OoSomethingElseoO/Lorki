import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  // Parallelize both queries instead of sequential fetches
  const [released, piecesSold] = await Promise.all([
    prisma.payout.groupBy({
      by: ["recipientType"],
      where: { status: "RELEASED" },
      _sum: { amountCents: true },
    }),
    prisma.artwork.count({
      where: { inventoryState: "SOLD" },
    }),
  ]);

  const totals = {
    artistCents: 0,
    conservancyCents: 0,
    operationsCents: 0,
  };

  for (const row of released) {
    const cents = row._sum.amountCents ?? 0;
    if (row.recipientType === "ARTIST") totals.artistCents = cents;
    if (row.recipientType === "CONSERVANCY") totals.conservancyCents = cents;
    if (row.recipientType === "OPERATIONS") totals.operationsCents = cents;
  }

  return NextResponse.json({ totals, piecesSold });
}
