import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// An artist sees only orders for artwork under their own campaigns, and
// only their own ARTIST-recipient payout rows — never another artist's
// numbers, never the conservancy/operations cut of their own sale.
export async function GET() {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const [orders, totals] = await Promise.all([
    prisma.order.findMany({
      where: { artwork: { campaign: { artistId: artist.id } } },
      include: { artwork: true, payouts: { where: { recipientType: "ARTIST" } }, shipment: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payout.aggregate({
      where: { order: { artwork: { campaign: { artistId: artist.id } } }, recipientType: "ARTIST" },
      _sum: { amountCents: true },
      by: ["status"],
    }),
  ]);

  const releasedCents = totals.find((t) => t.status === "RELEASED")?._sum?.amountCents ?? 0;
  const pendingCents = totals.find((t) => t.status === "PENDING")?._sum?.amountCents ?? 0;

  return NextResponse.json({ orders, totals: { releasedCents, pendingCents } });
}
