import { prisma } from "@/lib/prisma";
import { ShipOrderForm } from "@/components/admin/ship-order-form";
import { DeliverOrderForm } from "@/components/admin/deliver-order-form";
import { RefundOrderButton } from "@/components/admin/refund-order-button";
import { CashSaleForm } from "@/components/admin/cash-sale-form";
import { RevivePayoutButton } from "@/components/admin/revive-payout-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { getCampaignLabel } from "@/lib/campaigns";
import { statusBadgeClass } from "@/lib/status-badge";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { buyerEmail: { contains: query, mode: "insensitive" as const } },
          { artwork: { title: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [orders, totalCount, availableArtworks] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        artwork: { include: { campaign: { include: { animal: true, conservancy: true, artist: true } } } },
        payouts: true,
        shipment: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.order.count({ where }),
    // RESERVED (an original mid-inquiry — see /api/inquiries) is a valid
    // pick here too, not just AVAILABLE: recording the cash sale is how
    // that reservation is meant to resolve, and excluding it would make
    // the exact piece an admin needs to sell disappear from this list
    // right when someone's actually trying to buy it. Only SOLD is
    // actually excluded.
    prisma.artwork.findMany({
      where: { inventoryState: { not: "SOLD" }, campaign: { status: "LIVE" } },
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

      <AdminSearchForm placeholder="Search by buyer email or artwork title" defaultValue={query} />

      <a
        className={buttonVariants({ variant: "outline", size: "sm" })}
        href={`/api/admin/export/orders${query ? `?q=${encodeURIComponent(query)}` : ""}`}
      >
        Export CSV
      </a>

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
              <td>
                <span className={statusBadgeClass(order.status)}>{order.status}</span>
              </td>
              <td>
                {order.payouts.map((payout) => (
                  <div key={payout.id} className="admin-form__hint">
                    {payout.recipientType}: ${(payout.amountCents / 100).toFixed(2)}{" "}
                    <span className={statusBadgeClass(payout.status)}>{payout.status}</span>{" "}
                    {payout.status === "FAILED" ? <RevivePayoutButton payoutId={payout.id} /> : null}
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
              <td>
                {order.status === "REFUNDED" ? (
                  <span className={statusBadgeClass("REFUNDED")}>Refunded</span>
                ) : (
                  <RefundOrderButton orderId={order.id} />
                )}
              </td>
            </tr>
          ))}
          {orders.length === 0 ? (
            <tr>
              <td colSpan={8}>
                <EmptyState
                  message={query ? `No orders match "${query}".` : "No orders yet."}
                  hint={query ? "Try a different search term." : "Orders show up here once a checkout or cash sale is recorded."}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/orders"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
