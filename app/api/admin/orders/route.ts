import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "50")));

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        artwork: { include: { campaign: { include: { animal: true, artist: true } } } },
        payouts: true,
        shipment: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count(),
  ]);

  return NextResponse.json({ orders, pagination: { page, pageSize, total } });
}
