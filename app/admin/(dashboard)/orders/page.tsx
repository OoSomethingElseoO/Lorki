import { prisma } from "@/lib/prisma";
import { ShipOrderForm } from "@/components/admin/ship-order-form";
import { CashSaleForm } from "@/components/admin/cash-sale-form";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const [orders, availableArtworks] = await Promise.all([
    prisma.order.findMany({
      include: {
        artwork: { include: { campaign: { include: { animal: true, artist: true } } } },
        payouts: true,
        shipment: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.artwork.findMany({
      where: { inventoryState: "AVAILABLE", campaign: { status: "LIVE" } },
      include: { campaign: { include: { animal: true, artist: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <h1>Orders</h1>

      <h2>Record a cash sale</h2>
      <p className="admin-form__hint">
        For a sale collected outside Stripe — cash in hand, bank transfer, at a market. Follows the same
        split and payout-on-shipment rules as a card sale.
      </p>
      <CashSaleForm
        artworks={availableArtworks.map((artwork) => ({
          id: artwork.id,
          title: artwork.title,
          priceCents: artwork.priceCents,
          campaignLabel: `${artwork.campaign.animal.name} × ${artwork.campaign.artist.name}`,
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
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                {order.artwork.title}
                <br />
                <span className="admin-form__hint">
                  {order.artwork.campaign.animal.name} &times; {order.artwork.campaign.artist.name}
                </span>
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
                  <span>
                    Shipped via {order.shipment.carrier} ({order.shipment.method})
                  </span>
                ) : order.status === "PAID" ? (
                  <ShipOrderForm orderId={order.id} />
                ) : (
                  "—"
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={7}>No orders yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
