import Link from "next/link";
import { redirect } from "next/navigation";
import { Megaphone, Package, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { statusBadgeClass } from "@/lib/status-badge";

export const dynamic = "force-dynamic";

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function SellerDashboardPage() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
  }

  const [campaigns, orders] = await Promise.all([
    prisma.campaign.findMany({
      where: { artistId: seller.id },
      include: { animal: { include: { conservancy: true } }, conservancy: true, artworks: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: { artwork: { campaign: { artistId: seller.id } } },
      include: { artwork: true, payouts: { where: { recipientType: "ARTIST" } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const releasedCents = orders
    .flatMap((o) => o.payouts)
    .filter((p) => p.status === "RELEASED")
    .reduce((sum, p) => sum + p.amountCents, 0);
  const pendingCents = orders
    .flatMap((o) => o.payouts)
    .filter((p) => p.status === "PENDING")
    .reduce((sum, p) => sum + p.amountCents, 0);

  // Cheap to build — every campaign's artworks are already fetched above
  // (no extra query), so a short "most recent" preview costs nothing extra
  // here. Full management (edit/delete) stays on /seller/artworks; this is
  // just a glance so the dashboard isn't just a heading + a button.
  const recentArtworks = campaigns
    .flatMap((campaign) => campaign.artworks)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <>
      <h1>Seller Dashboard</h1>
      <p className="admin-form__hint">
        Selling as <strong>{seller.name}</strong> ({seller.country})
      </p>

      <section className="impact-totals" aria-label="Your earnings">
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{formatDollars(releasedCents)}</span>
          <span className="impact-totals__label">Paid out to you</span>
        </div>
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{formatDollars(pendingCents)}</span>
          <span className="impact-totals__label">Pending (held until shipped)</span>
        </div>
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{orders.length}</span>
          <span className="impact-totals__label">Total sales</span>
        </div>
      </section>

      <Tabs defaultValue="campaigns">
        <TabsList aria-label="Seller dashboard sections">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Your campaigns</CardTitle>
              <Link href="/seller/campaigns/new" className={buttonVariants()}>
                Start a new campaign
              </Link>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <EmptyState
                  icon={<Megaphone />}
                  title="No campaigns yet"
                  description="Start a campaign to pick a cause and begin listing artwork."
                />
              ) : (
                campaigns.map((campaign) => (
                  <article className="campaign-card" key={campaign.id} style={{ marginBottom: "1rem" }}>
                    <h3>
                      {getCampaignCauseName(campaign)}
                      {campaign.status !== "LIVE" ? (
                        <>
                          {" "}
                          <span className={statusBadgeClass(campaign.status)}>{campaign.status}</span>
                        </>
                      ) : null}
                    </h3>
                    <p>
                      <span className="detail-label">Conservancy:</span>{" "}
                      {campaign.animal?.conservancy.name ?? campaign.conservancy?.name ?? "Unknown cause"}
                    </p>
                    <p className="campaign-card__split">
                      <span>{campaign.artistPercent}% you</span>
                      <span>{campaign.conservancyPercent}% conservancy</span>
                      <span>{campaign.operationsPercent}% operations</span>
                    </p>
                    <p>{campaign.artworks.length} listing(s)</p>
                    {campaign.status === "DRAFT" ? (
                      <p className="admin-form__hint">
                        Awaiting review — we&apos;ll set the final price and publish once it&apos;s approved. You can
                        keep submitting pieces in the meantime.
                      </p>
                    ) : null}
                    {campaign.status === "LIVE" || campaign.status === "DRAFT" ? (
                      <Link href={`/seller/artworks/new?campaignId=${campaign.id}`} className={buttonVariants()}>
                        List a new piece
                      </Link>
                    ) : (
                      <p className="admin-form__hint">
                        {`This campaign is ${campaign.status.toLowerCase()} — an admin paused or archived it, so new listings aren't accepted right now. Your existing listings aren't affected.`}
                      </p>
                    )}
                  </article>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Your listings</CardTitle>
              <Link href="/seller/artworks" className={buttonVariants()}>
                Manage all listings
              </Link>
            </CardHeader>
            <CardContent>
              {recentArtworks.length === 0 ? (
                <EmptyState
                  icon={<Package />}
                  title="No listings yet"
                  description="Once a campaign is live, list a piece from it and it'll show up here."
                />
              ) : (
                <ul className="account-orders__list">
                  {recentArtworks.map((artwork) => (
                    <li className="account-orders__item" key={artwork.id}>
                      <img src={artwork.imageUrl} alt={artwork.altText} />
                      <div>
                        <h3>{artwork.title}</h3>
                        <p className="price">{formatDollars(artwork.priceCents)}</p>
                        <p>{artwork.inventoryState}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <Card variant="brand">
            <CardHeader>
              <CardTitle>Your sales</CardTitle>
            </CardHeader>
            <CardContent>
              {orders.length === 0 ? (
                <EmptyState
                  icon={<ShoppingBag />}
                  title="No sales yet"
                  description="Once someone buys one of your pieces, it'll show up here."
                />
              ) : (
                <ul className="account-orders__list">
                  {orders.map((order) => (
                    <li className="account-orders__item" key={order.id}>
                      <img src={order.artwork.imageUrl} alt={order.artwork.altText} />
                      <div>
                        <h3>{order.artwork.title}</h3>
                        <p className="price">
                          Your cut: {formatDollars(order.payouts[0]?.amountCents ?? 0)} (
                          {order.payouts[0]?.status ?? "PENDING"})
                        </p>
                        <p>{order.status}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
