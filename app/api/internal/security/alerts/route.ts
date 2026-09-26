import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runSecurityAlertSweep } from "@/lib/security-alerts";
import { apiContractError } from "@/lib/api-contract";

function authorized(request: Request) {
  const expected = process.env.SECURITY_ALERT_CRON_SECRET;
  const supplied = request.headers.get("x-security-alert-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorized(request)) return apiContractError("UNAUTHORIZED", "Unauthorized", 401);
  try {
    return NextResponse.json(await runSecurityAlertSweep());
  } catch (error) {
    console.error("[security:alert-sweep] failed", error);
    return apiContractError("INTERNAL_ERROR", "Security alert sweep failed", 500);
  }
}
