import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

export async function GET() {
  const { authorized } = checkPermission(await getCurrentUser(), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const inquiries = await prisma.inquiry.findMany({
    include: {
      artwork: { include: { campaign: { include: { animal: true, artist: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ inquiries });
}
