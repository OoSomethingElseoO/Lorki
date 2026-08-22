import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const inquiries = await prisma.inquiry.findMany({
    include: {
      artwork: { include: { campaign: { include: { animal: true, artist: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ inquiries });
}
