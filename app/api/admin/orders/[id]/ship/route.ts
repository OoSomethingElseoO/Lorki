import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendShippingNotificationEmail } from "@/lib/email";

type ShipBody = {
  carrier: string;
  trackingNumber?: string;
  method: "ORIGINAL_FOUNDER" | "ORIGINAL_FREIGHT" | "PRINT_POD";
};

type RouteParams = { params: Promise<{ id: string }> };

// Phase 0: payout release is recorded here, not executed via Stripe Connect
// (see BACKEND_PRD.md §11 — Connect payouts to Kenya-based recipients are an
// open decision). Marking a Payout RELEASED here means "the obligation is
// confirmed and reconciled outside Stripe," not "a Stripe Transfer fired."
export async function POST(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<ShipBody>;

  if (!body.carrier || !body.method) {
    return NextResponse.json({ error: "carrier and method are required" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payouts: true, shipment: true, artwork: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  if (order.status !== "PAID") {
    return NextResponse.json({ error: `Cannot ship an order with status ${order.status}` }, { status: 409 });
  }

  if (order.shipment) {
    return NextResponse.json({ error: "Order already has a shipment" }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: "SHIPPED" } }),
    prisma.shipment.create({
      data: {
        orderId: order.id,
        carrier: body.carrier,
        trackingNumber: body.trackingNumber,
        method: body.method,
        shippedAt: new Date(),
      },
    }),
    prisma.payout.updateMany({
      where: { orderId: order.id, status: "PENDING" },
      data: { status: "RELEASED", releasedAt: new Date() },
    }),
  ]);

  await sendShippingNotificationEmail({
    buyerEmail: order.buyerEmail,
    artworkTitle: order.artwork.title,
    carrier: body.carrier,
    trackingNumber: body.trackingNumber,
  });

  return NextResponse.json({ ok: true });
}
