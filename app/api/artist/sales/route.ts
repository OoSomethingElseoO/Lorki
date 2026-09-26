import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { artistRequired } from "@/lib/authorization";
import { apiContractError, apiJson } from "@/lib/api-contract";

// An artist sees only orders for artwork under their own campaigns, and
// only their own ARTIST-recipient payout rows — never another artist's
// numbers, never the conservancy/operations cut of their own sale.
export async function GET(request: Request) {
  const currentUser = await getCurrentUser(request);
  const artist = artistRequired(currentUser);
  if (!artist) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  const [orders, totals] = await Promise.all([
    prisma.order.findMany({
      where: { artwork: { campaign: { artistId: artist.id } } },
      include: { artwork: true, payouts: { where: { recipientType: "ARTIST" } }, shipment: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payout.groupBy({
      where: { order: { artwork: { campaign: { artistId: artist.id } } }, recipientType: "ARTIST" },
      _sum: { amountCents: true },
      by: ["status"],
    }),
  ]);

  const releasedCents = totals.find((t) => t.status === "RELEASED")?._sum?.amountCents ?? 0;
  const pendingCents = totals.find((t) => t.status === "PENDING")?._sum?.amountCents ?? 0;

  return apiJson({ orders, totals: { releasedCents, pendingCents } });
}
