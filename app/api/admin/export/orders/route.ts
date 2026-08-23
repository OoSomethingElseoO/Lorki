import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { getCampaignLabel } from "@/lib/campaigns";

// Exports every order matching the same search as /admin/orders — not just
// the current page — since a report an admin pulls offline should reflect
// the whole filtered set, not one page's worth of rows.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();

  const where = query
    ? {
        OR: [
          { buyerEmail: { contains: query, mode: "insensitive" as const } },
          { artwork: { title: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const orders = await prisma.order.findMany({
    where,
    include: {
      artwork: { include: { campaign: { include: { animal: true, conservancy: true, artist: true } } } },
      shipment: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const rows = [
    ["Order ID", "Created", "Buyer email", "Artwork", "Cause × artist", "Amount (USD)", "Payment method", "Status", "Fulfillment"],
    ...orders.map((order) => [
      order.id,
      order.createdAt.toISOString(),
      order.buyerEmail,
      order.artwork.title,
      getCampaignLabel(order.artwork.campaign),
      (order.amountCents / 100).toFixed(2),
      order.paymentMethod,
      order.status,
      order.shipment
        ? `${order.shipment.deliveredAt ? "Delivered" : "Shipped"} via ${order.shipment.carrier}`
        : order.status === "DELIVERED"
          ? "Delivered (in person)"
          : "",
    ]),
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders-export.csv"',
    },
  });
}
