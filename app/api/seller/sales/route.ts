import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// A seller sees only orders for artwork under their own campaigns, and
// only their own ARTIST-recipient payout rows — never another seller's
// numbers, never the conservancy/operations cut of their own sale.
export async function GET() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { artwork: { campaign: { artistId: seller.id } } },
    include: { artwork: true, payouts: { where: { recipientType: "ARTIST" } }, shipment: true },
    orderBy: { createdAt: "desc" },
  });

  const releasedCents = orders
    .flatMap((order) => order.payouts)
    .filter((payout) => payout.status === "RELEASED")
    .reduce((sum, payout) => sum + payout.amountCents, 0);

  const pendingCents = orders
    .flatMap((order) => order.payouts)
    .filter((payout) => payout.status === "PENDING")
    .reduce((sum, payout) => sum + payout.amountCents, 0);

  return NextResponse.json({ orders, totals: { releasedCents, pendingCents } });
}
