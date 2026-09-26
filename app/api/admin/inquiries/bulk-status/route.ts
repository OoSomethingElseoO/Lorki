import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type BulkBody = { inquiryIds?: string[]; status?: "NEW" | "CONTACTED" | "CLOSED" };

const VALID_STATUSES = ["NEW", "CONTACTED", "CLOSED"];

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const body = await readJsonObject(request) as Partial<BulkBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!Array.isArray(body.inquiryIds) || body.inquiryIds.length === 0) {
    return apiContractError("VALIDATION_ERROR", "inquiryIds must be a non-empty array", 400);
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return apiContractError("VALIDATION_ERROR", "status must be NEW, CONTACTED, or CLOSED", 400);
  }

  // Needed before the bulk status update below only for the CLOSED case
  // (see the release call at the bottom) — artworkId never changes on an
  // Inquiry, so reading it before or after the status write makes no
  // difference.
  const artworkIds = body.status === "CLOSED"
    ? (
        await prisma.inquiry.findMany({
          where: { id: { in: body.inquiryIds } },
          select: { artworkId: true },
        })
      ).map((inquiry) => inquiry.artworkId)
    : [];

  const result = await prisma.inquiry.updateMany({
    where: { id: { in: body.inquiryIds } },
    data: { status: body.status },
  });

  // Same "closing is a definite not-a-sale signal" reasoning as the
  // single-inquiry route — release every affected piece still RESERVED in
  // one query rather than looping. No-ops for any that already moved on.
  if (body.status === "CLOSED" && artworkIds.length > 0) {
    await prisma.artwork.updateMany({
      where: { id: { in: artworkIds }, inventoryState: "RESERVED" },
      data: { inventoryState: "AVAILABLE", reservedAt: null },
    });
  }

  await recordAudit({ action: "INQUIRIES_STATUS_CHANGED_BULK", affectedEntityType: "Inquiry", affectedEntityId: "bulk", reason: `Bulk inquiry status change to ${body.status}`, changedBy: user!.email, metadata: { requestedIds: body.inquiryIds, updatedCount: result.count, status: body.status } });
  return NextResponse.json({ count: result.count });
}
