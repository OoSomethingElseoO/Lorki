import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { parseShareEventInput } from "@/lib/share-events";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function POST(request: Request) {
  if (!isFeatureEnabled("SHARE_ANALYTICS")) return NextResponse.json({ ok: true, analyticsEnabled: false });
  const ip = getRequestIp(request);
  if (await isRateLimited(`share-event:${ip}`, 30, 60 * 60 * 1000)) return NextResponse.json({ ok: true });
  const body = await readJsonObject(request);
  const input = parseShareEventInput(body);
  if (!input) return apiContractError("VALIDATION_ERROR", "Invalid share target", 400);
  const user = await getCurrentUser(request);
  await prisma.shareEvent.create({ data: { ...input, userId: user?.id ?? null } });
  return NextResponse.json({ ok: true }, { status: 201 });
}
