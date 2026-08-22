import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// Records the real-world act of actually sending money — used both for
// payouts with no automated rail (the admin wired/paid cash and is
// confirming it here) and, in principle, for a manual override on an
// automated one. Idempotent: marking an already-paid-out payout again is a
// no-op, not an error.
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  if (payout.status !== "RELEASED") {
    return NextResponse.json({ error: `Cannot mark paid out — payout status is ${payout.status}, not RELEASED` }, { status: 409 });
  }

  const updated = await prisma.payout.update({
    where: { id },
    data: { paidOutAt: payout.paidOutAt ?? new Date() },
  });

  return NextResponse.json({ payout: updated });
}
