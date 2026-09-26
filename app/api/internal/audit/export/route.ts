import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { apiContractError } from "@/lib/api-contract";

function authorized(request: Request) {
  const expected = process.env.AUDIT_EXPORT_SECRET;
  const supplied = request.headers.get("x-audit-export-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return apiContractError("UNAUTHORIZED", "Unauthorized", 401);
  const url = new URL(request.url);
  const parsedSince = url.searchParams.get("since");
  const since = parsedSince && !Number.isNaN(Date.parse(parsedSince)) ? new Date(parsedSince) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [audit, providerEvents] = await Promise.all([
    prisma.auditLog.findMany({ where: { createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, take: 5000 }),
    prisma.paymentProviderEvent.findMany({ where: { receivedAt: { gte: since } }, orderBy: { receivedAt: "asc" }, take: 5000 }),
  ]);
  const auditTruncated = audit.length === 5000;
  const providerEventsTruncated = providerEvents.length === 5000;
  const lines = [...audit.map((entry) => JSON.stringify({ type: "audit", ...entry })), ...providerEvents.map((entry) => JSON.stringify({ type: "provider_event", ...entry }))].join("\n");
  return new NextResponse(lines + (lines ? "\n" : ""), { headers: {
    "content-type": "application/x-ndjson",
    "cache-control": "no-store",
    "x-audit-record-count": String(audit.length),
    "x-provider-event-count": String(providerEvents.length),
    "x-audit-export-truncated": String(auditTruncated || providerEventsTruncated),
  } });
}
