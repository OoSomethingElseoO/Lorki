import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "LIVE" },
    include: {
      animal: { include: { conservancy: true } },
      artist: { include: { socialLinks: true } },
    },
  });

  return NextResponse.json({ campaigns });
}
