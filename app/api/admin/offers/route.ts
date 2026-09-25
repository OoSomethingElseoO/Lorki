import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

export async function GET() {
  const { authorized } = checkPermission(await getCurrentUser(), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const offers = await prisma.offer.findMany({
    include: { artwork: { select: { id: true, title: true, saleMode: true, offerClosesAt: true } }, order: { select: { id: true, status: true } } },
    orderBy: [{ status: "asc" }, { amountCents: "desc" }, { submittedAt: "asc" }],
  });
  return NextResponse.json({ offers });
}
