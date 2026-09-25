import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { parseShareEventInput } from "@/lib/share-events";

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`share-event:${ip}`, 30, 60 * 60 * 1000)) return NextResponse.json({ ok: true });
  const body = await request.json().catch(() => null);
  const input = parseShareEventInput(body);
  if (!input) return NextResponse.json({ error: "Invalid share target" }, { status: 400 });
  const user = await getCurrentUser();
  await prisma.shareEvent.create({ data: { ...input, userId: user?.id ?? null } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
