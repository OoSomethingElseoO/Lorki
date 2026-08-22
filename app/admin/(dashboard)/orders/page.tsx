import { prisma } from "@/lib/prisma";
import { ShipOrderForm } from "@/components/admin/ship-order-form";
import { DeliverOrderForm } from "@/components/admin/deliver-order-form";
import { RefundOrderButton } from "@/components/admin/refund-order-button";
import { CashSaleForm } from "@/components/admin/cash-sale-form";
import { getCampaignLabel } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, availableArtworks] = await Promise.all([
    prisma.order.findMany({
      include: {
        artwork: { include: { campaign: { include: { animal: true, conservancy: true, artist: true } } } },
        payouts: true,
        shipment: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.artwork.findMany({
      where: { inventoryState: "AVAILABLE", campaign: { status: "LIVE" } },
      include: { campaign: { include: { animal: true, conservancy: true, artist: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <h1>Orders</h1>

      <h2>Record a cash sale</h2>
      <p className="admin-form__hint">
        For a sale collected outside Stripe — cash in hand, bank transfer, at a market. Follows the same
        split as a card sale, and the same payout-held-until-delivered rule unless it's an in-person handoff.
      </p>
      <CashSaleForm
        artworks={availableArtworks.map((artwork) => ({
          id: artwork.id,
          title: artwork.title,
          priceCents: artwork.priceCents,
          campaignLabel: getCampaignLabel(artwork.campaign),
        }))}
      />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Artwork</th>
            <th>Buyer</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Status</th>
            <th>Payouts</th>
            <th>Fulfillment</th>
            <th>Refund</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                {order.artwork.title}
                <br />
                <span className="admin-form__hint">{getCampaignLabel(order.artwork.campaign)}</span>
              </td>
              <td>{order.buyerEmail}</td>
              <td>${(order.amountCents / 100).toFixed(2)}</td>
              <td>{order.paymentMethod === "CASH" ? "Cash" : "Card"}</td>
              <td>{order.status}</td>
              <td>
                {order.payouts.map((payout) => (
                  <div key={payout.id} className="admin-form__hint">
                    {payout.recipientType}: ${(payout.amountCents / 100).toFixed(2)} ({payout.status})
                  </div>
                ))}
              </td>
              <td>
                {order.shipment ? (
                  <>
                    <span>
                      {order.shipment.deliveredAt ? "Delivered" : "Shipped"} via {order.shipment.carrier} (
                      {order.shipment.method})
                      {order.shipment.deliveredAt
                        ? ` — ${order.shipment.deliveredAt.toLocaleDateString()}`
                        : null}
                    </span>
                    {!order.shipment.deliveredAt && order.status === "SHIPPED" ? (
                      <DeliverOrderForm orderId={order.id} />
                    ) : null}
                  </>
                ) : order.status === "PAID" ? (
                  <ShipOrderForm orderId={order.id} />
                ) : order.status === "DELIVERED" ? (
                  "Delivered (in person)"
                ) : (
                  "—"
                )}
              </td>
              <td>{order.status === "REFUNDED" ? "Refunded" : <RefundOrderButton orderId={order.id} />}</td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8}>No orders yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
