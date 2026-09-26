import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepPaymentReconciliation } from "@/lib/reconciliation";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

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
  if (!authorized(request)) return apiContractError("UNAUTHORIZED", "Unauthorized", 401);
  const body = await readJsonObject(request) as { days?: unknown } | null;
  const days = body?.days === undefined ? 30 : body.days;
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > 3650) {
    return apiContractError("VALIDATION_ERROR", "days must be an integer between 1 and 3650", 400);
  }
  try {
    return NextResponse.json(await sweepPaymentReconciliation(days));
  } catch (error) {
    console.error("[reconciliation:sweep] failed", error);
    return apiContractError("INTERNAL_ERROR", "Reconciliation sweep failed", 500);
  }
}
