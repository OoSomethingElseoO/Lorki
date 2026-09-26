import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendShippingNotificationEmail } from "@/lib/email";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type ShipBody = {
  carrier: string;
  trackingNumber?: string;
  method: "ORIGINAL_FOUNDER" | "ORIGINAL_FREIGHT" | "PRINT_POD";
};

type RouteParams = { params: Promise<{ id: string }> };

// Payout release does NOT happen here — shipped isn't delivered, and the
// buyer needs to actually have the piece in hand before money moves to the
// artist/conservancy/ops (see app/api/admin/orders/[id]/deliver/route.ts,
// which is what flips Payouts from PENDING to RELEASED).
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as Partial<ShipBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.carrier || !body.method) {
    return apiContractError("VALIDATION_ERROR", "carrier and method are required", 400);
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: { payouts: true, shipment: true, artwork: true },
  });

  if (!order) {
    return apiContractError("NOT_FOUND", "Order not found", 404);
  }

  if (order.status !== "PAID") {
    return apiContractError("CONFLICT", `Cannot ship an order with status ${order.status}`, 409);
  }

  if (order.shipment) {
    return apiContractError("CONFLICT", "Order already has a shipment", 409);
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
  ]);
  await recordAudit({ action: "ORDER_MARKED_SHIPPED", affectedEntityType: "Order", affectedEntityId: order.id, reason: "Operations administrator recorded shipment", changedBy: user!.email, metadata: { carrier: body.carrier, trackingNumber: body.trackingNumber ?? null, method: body.method } });

  // Not awaited — the shipment above is already committed, same reasoning
  // as the Stripe webhook (app/api/webhooks/stripe/route.ts).
  sendShippingNotificationEmail({
    buyerEmail: order.buyerEmail,
    artworkTitle: order.artwork.title,
    carrier: body.carrier,
    trackingNumber: body.trackingNumber,
  });

  return NextResponse.json({ ok: true });
}
