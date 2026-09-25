import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(), "FINANCE_ADMIN");
  if (!authorized) return unauthorized("FINANCE_ADMIN");
  const daysParam = Number(new URL(request.url).searchParams.get("days") ?? "30");
  const days = Number.isFinite(daysParam) ? Math.min(90, Math.max(1, Math.floor(daysParam))) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [cases, failedEvents, receivedEvents, recentEvents, unmatchedOrders] = await Promise.all([
    prisma.paymentReconciliation.findMany({ where: { observedAt: { gte: since }, status: { not: "RESOLVED" } }, orderBy: { observedAt: "desc" } }),
    prisma.paymentProviderEvent.findMany({ where: { receivedAt: { gte: since }, status: "FAILED" }, orderBy: { receivedAt: "desc" } }),
    prisma.paymentProviderEvent.count({ where: { receivedAt: { gte: since } } }),
    prisma.paymentProviderEvent.findMany({ where: { receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 200 }),
    prisma.order.findMany({
      where: {
        createdAt: { gte: since },
        status: "PAID",
        stripePaymentIntentId: { not: null },
        reconciliations: { none: {} },
      },
      select: { id: true, stripePaymentIntentId: true, amountCents: true, currency: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return NextResponse.json({ since, days, summary: { openCases: cases.length, failedEvents: failedEvents.length, providerEvents: receivedEvents, unmatchedOrders: unmatchedOrders.length }, cases, failedEvents, recentEvents, unmatchedOrders });
}
