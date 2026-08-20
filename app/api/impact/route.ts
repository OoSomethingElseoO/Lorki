import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const released = await prisma.payout.groupBy({
    by: ["recipientType"],
    where: { status: "RELEASED" },
    _sum: { amountCents: true },
  });

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

  const piecesSold = await prisma.artwork.count({
    where: { inventoryState: "SOLD" },
  });

  return NextResponse.json({ totals, piecesSold });
}
