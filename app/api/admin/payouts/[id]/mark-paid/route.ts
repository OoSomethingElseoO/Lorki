import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";

type RouteParams = { params: Promise<{ id: string }> };

// Records the real-world act of actually sending money — used both for
// payouts with no automated rail (the admin wired/paid cash and is
// confirming it here) and, in principle, for a manual override on an
// automated one. Idempotent: marking an already-paid-out payout again is a
// no-op, not an error.
export async function POST(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) {
    return unauthorized("FINANCE_ADMIN");
  }

  const { id } = await params;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  // ✅ IDEMPOTENCY: If already marked paid, return success (idempotent)
  if (payout.paidOutAt !== null) {
    return NextResponse.json({
      message: "Payout already marked paid",
      payout
    });
  }

  if (payout.status !== "RELEASED") {
    return NextResponse.json({ error: `Cannot mark paid out — payout status is ${payout.status}, not RELEASED` }, { status: 409 });
  }

  const updated = await prisma.payout.update({
    where: { id },
    data: { paidOutAt: new Date() },
  });

  return NextResponse.json({ payout: updated });
}
