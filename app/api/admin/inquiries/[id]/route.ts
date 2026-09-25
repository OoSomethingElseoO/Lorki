import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNotFoundError } from "@/lib/prisma-errors";
import { releaseReservationIfHeld } from "@/lib/reservations";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  status: "NEW" | "CONTACTED" | "APPROVED" | "REJECTED" | "CLOSED";
};

const VALID_STATUSES = ["NEW", "CONTACTED", "APPROVED", "REJECTED", "CLOSED"];

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "status must be NEW, CONTACTED, APPROVED, REJECTED, or CLOSED" }, { status: 400 });
  }

  try {
    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: { status: body.status },
    });

    // Closing an inquiry is a definite "not turning into a sale" signal —
    // no reason to make the piece wait out the rest of its reservation
    // hold once that's known. No-ops if the piece already moved on (e.g.
    // the admin recorded the sale first and is closing the inquiry after).
    if (body.status === "CLOSED" || body.status === "REJECTED") {
      await releaseReservationIfHeld(inquiry.artworkId);
    }

    await recordAudit({ action: "INQUIRY_STATUS_CHANGED", affectedEntityType: "Inquiry", affectedEntityId: id, reason: `Inquiry status changed to ${body.status}`, changedBy: user!.email, metadata: { artworkId: inquiry.artworkId, status: body.status } });

    return NextResponse.json({ inquiry });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    throw error;
  }
}
