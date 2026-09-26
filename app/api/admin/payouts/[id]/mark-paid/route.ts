import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/auth";
import { checkIdempotency, storeIdempotencyResponse } from "@/lib/idempotency";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { sendPayoutNotificationEmail } from "@/lib/email";
import { enforceHighRiskMfa } from "@/lib/mfa-policy";

type RouteParams = { params: Promise<{ id: string }> };

// Records the real-world act of actually sending money — used both for
// payouts with no automated rail (the admin wired/paid cash and is
// confirming it here) and, in principle, for a manual override on an
// automated one. Idempotent: marking an already-paid-out payout again is a
// no-op, not an error.
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) {
    return unauthorized("FINANCE_ADMIN");
  }
  const mfaError = await enforceHighRiskMfa(request);
  if (mfaError) return mfaError;

  // ✅ Check for idempotent retry
  const cached = await checkIdempotency(request, user?.id);
  if (cached) return cached;

  const { id } = await params;

  const payout = await prisma.payout.findUnique({ where: { id }, include: { order: { include: { artwork: true } } } });
  if (!payout) {
    return apiContractError("NOT_FOUND", "Payout not found", 404);
  }

  // ✅ IDEMPOTENCY: If already marked paid, return success (idempotent)
  if (payout.paidOutAt !== null) {
    const response = NextResponse.json({
      message: "Payout already marked paid",
      payout
    });
    // ✅ Store for future retries
    await storeIdempotencyResponse(
      request.headers.get("Idempotency-Key"),
      user?.id,
      200,
      { message: "Payout already marked paid", payout }
    ).catch((e) => console.error("[idempotency:storage-failed]", e));
    return response;
  }

  if (payout.status !== "RELEASED") {
    return apiContractError("CONFLICT", `Cannot mark paid out — payout status is ${payout.status}, not RELEASED`, 409);
  }

  const updated = await prisma.payout.update({
    where: { id },
    data: { paidOutAt: new Date() },
  });
  await recordAudit({ action: "PAYOUT_MARKED_PAID_MANUAL", affectedEntityType: "Payout", affectedEntityId: id, reason: "Finance administrator recorded an external payout", changedBy: user!.email, metadata: { amountCents: updated.amountCents, orderId: updated.orderId } });
  if (updated.recipientType === "ARTIST") {
    const artist = await prisma.artist.findUnique({ where: { id: updated.recipientId }, include: { user: { select: { email: true } } } });
    if (artist?.user?.email) sendPayoutNotificationEmail(artist.user.email, payout.order.artwork.title, `$${(updated.amountCents / 100).toFixed(2)}`, "paid").catch(() => undefined);
  }

  const response = NextResponse.json({ payout: updated });
  // ✅ Store for future retries
  await storeIdempotencyResponse(
    request.headers.get("Idempotency-Key"),
    user?.id,
    200,
    { payout: updated }
  ).catch((e) => console.error("[idempotency:storage-failed]", e));
  return response;
}
