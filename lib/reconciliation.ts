import { prisma } from "@/lib/prisma";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function sweepPaymentReconciliation(days = 30) {
  const windowDays = Math.min(90, Math.max(1, Math.floor(days)));
  const since = new Date(Date.now() - windowDays * DAY_MS);
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: since },
      status: "PAID",
      stripePaymentIntentId: { not: null },
      reconciliations: { none: {} },
    },
    select: { id: true, stripePaymentIntentId: true, amountCents: true, currency: true },
  });

  let created = 0;
  for (const order of orders) {
    if (!order.stripePaymentIntentId) continue;
    const existing = await prisma.paymentReconciliation.findFirst({
      where: { orderId: order.id, status: "MISSING_PROVIDER_PAYMENT" },
      select: { id: true },
    });
    if (existing) continue;
    await prisma.paymentReconciliation.create({
      data: {
        provider: "STRIPE",
        externalId: order.stripePaymentIntentId,
        orderId: order.id,
        expectedAmountCents: order.amountCents,
        expectedCurrency: order.currency,
        status: "MISSING_PROVIDER_PAYMENT",
        eventType: "reconciliation.sweep",
        metadata: { reason: "Local order has a payment intent but no provider comparison" },
      },
    });
    created += 1;
  }

  return { days: windowDays, since, scannedOrders: orders.length, createdCases: created };
}
