import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { normalizePerformanceBatch } from "@/lib/performance-metrics";

export async function POST(request: Request) {
  const rateKey = createHash("sha256").update(`performance:${getRequestIp(request)}`).digest("hex");
  try {
    if (await isRateLimited(`performance:${rateKey}`, 30, 60 * 60 * 1000)) {
      return NextResponse.json({ ok: true, sampled: false });
    }
  } catch {
    // RUM must never turn a database outage into a browser-visible 500. The
    // measurement is optional; skip it and let the client continue normally.
    return NextResponse.json({ ok: true, sampled: false, reason: "storage_unavailable" }, { status: 202 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const rows = normalizePerformanceBatch(body);
  if (!rows) return NextResponse.json({ ok: false, error: "Invalid performance batch" }, { status: 400 });
  const release = process.env.RELEASE_VERSION?.slice(0, 80) || null;
  try {
    await prisma.performanceMetric.createMany({ data: rows.map((row) => ({ ...row, release })) });
  } catch {
    // Performance telemetry is best-effort and must not surface infrastructure
    // failures to the page that sent it.
    return NextResponse.json({ ok: true, sampled: false, reason: "storage_unavailable" }, { status: 202 });
  }
  return NextResponse.json({ ok: true });
}
