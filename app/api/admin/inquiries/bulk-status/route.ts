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

  const result = await prisma.inquiry.updateMany({
    where: { id: { in: body.inquiryIds } },
    data: { status: body.status },
  });

  return NextResponse.json({ count: result.count });
}
