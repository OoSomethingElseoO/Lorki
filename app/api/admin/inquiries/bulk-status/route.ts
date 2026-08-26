import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type BulkBody = { inquiryIds?: string[]; status?: "NEW" | "CONTACTED" | "CLOSED" };

const VALID_STATUSES = ["NEW", "CONTACTED", "CLOSED"];

export async function PATCH(request: Request) {
  const body = (await request.json()) as Partial<BulkBody>;

  if (!Array.isArray(body.inquiryIds) || body.inquiryIds.length === 0) {
    return NextResponse.json({ error: "inquiryIds must be a non-empty array" }, { status: 400 });
  }

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "status must be NEW, CONTACTED, or CLOSED" }, { status: 400 });
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

  return NextResponse.json({ count: result.count });
}
