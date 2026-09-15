import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { checkIdempotency, storeIdempotencyResponse } from "@/lib/idempotency";

type RouteParams = { params: Promise<{ id: string }> };

// Records the real-world act of actually sending money — used both for
// payouts with no automated rail (the admin wired/paid cash and is
// confirming it here) and, in principle, for a manual override on an
// automated one. Idempotent: marking an already-paid-out payout again is a
// no-op, not an error.
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) {
    return unauthorized("FINANCE_ADMIN");
  }

  // ✅ Check for idempotent retry
  const cached = await checkIdempotency(request, user?.id);
  if (cached) return cached;

  const { id } = await params;

  const payout = await prisma.payout.findUnique({ where: { id } });
  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  // ✅ IDEMPOTENCY: If already marked paid, return success (idempotent)
  if (payout.paidOutAt !== null) {
    const response = NextResponse.json({
      message: "Payout already marked paid",
      payout
    });
    // ✅ Store for future retries
    await storeIdempotencyResponse(
      request.headers.get("Idempotency-Key") || "no-key",
      user?.id,
      200,
      { message: "Payout already marked paid", payout }
    ).catch((e) => console.error("[idempotency:storage-failed]", e));
    return response;
  }

  if (payout.status !== "RELEASED") {
    return NextResponse.json({ error: `Cannot mark paid out — payout status is ${payout.status}, not RELEASED` }, { status: 409 });
  }

  const updated = await prisma.payout.update({
    where: { id },
    data: { paidOutAt: new Date() },
  });

  const response = NextResponse.json({ payout: updated });
  // ✅ Store for future retries
  await storeIdempotencyResponse(
    request.headers.get("Idempotency-Key") || "no-key",
    user?.id,
    200,
    { payout: updated }
  ).catch((e) => console.error("[idempotency:storage-failed]", e));
  return response;
}
