import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepPaymentReconciliation } from "@/lib/reconciliation";

function authorized(request: Request) {
  const expected = process.env.RECONCILIATION_CRON_SECRET;
  if (!expected) return false;
  const supplied = request.headers.get("x-reconciliation-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { days?: unknown };
  const days = typeof body.days === "number" ? body.days : 30;
  try {
    return NextResponse.json(await sweepPaymentReconciliation(days));
  } catch (error) {
    console.error("[reconciliation:sweep] failed", error);
    return NextResponse.json({ error: "Reconciliation sweep failed" }, { status: 500 });
  }
}
