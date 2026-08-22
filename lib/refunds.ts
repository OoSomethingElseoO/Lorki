import { prisma } from "@/lib/prisma";

// Shared by the Stripe webhook's charge.refunded handler (dashboard-initiated
// refunds) and the admin refund route (in-app refunds) so the side effects
// of "this order got refunded" live in exactly one place.
export async function processRefund(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { artwork: true } });
  if (!order) {
    throw new Error(`Order ${orderId} not found`);
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: "REFUNDED" } });

    // Only claw back payouts still PENDING — anything already RELEASED needs
    // manual reconciliation outside this table, not an automatic reversal.
    await tx.payout.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED" },
    });

    // A refunded one-of-one original must go back on sale, otherwise it's
    // stuck SOLD forever with no order to show for it.
    if (order.artwork.kind === "ORIGINAL" && order.artwork.inventoryState === "SOLD") {
      await tx.artwork.update({
        where: { id: order.artwork.id },
        data: { inventoryState: "AVAILABLE", reservedAt: null },
      });
    }

    return updated;
  });
}
