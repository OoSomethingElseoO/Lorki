import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { LogoutButton } from "@/components/logout-button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";

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

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Seller Dashboard</PageTitle>

        <div className="account-summary">
          <p>
            Selling as <strong>{seller.name}</strong> ({seller.country})
          </p>
          <Link href="/seller/profile" className="button-link">
            Edit profile
          </Link>
          <LogoutButton />
        </div>

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

        <section aria-label="Your campaigns">
          <div className="admin-campaign-card__controls" style={{ justifyContent: "space-between", display: "flex", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0 }}>Your campaigns</h2>
            <Link href="/seller/campaigns/new" className="button-link">
              Start a new campaign
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <p>You don&apos;t have any campaigns yet — start one to begin listing artwork.</p>
          ) : (
            campaigns.map((campaign) => (
              <article className="campaign-card" key={campaign.id} style={{ marginBottom: "1rem" }}>
                <h3>{getCampaignCauseName(campaign)}</h3>
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
                <Link href={`/seller/artworks/new?campaignId=${campaign.id}`} className="button-link">
                  List a new piece
                </Link>
              </article>
            ))
          )}
        </section>

        <section aria-label="Your listings" style={{ marginTop: "2rem" }}>
          <h2>Your listings</h2>
          <Link href="/seller/artworks" className="button-link">
            Manage all listings
          </Link>
        </section>

        <section className="account-orders" aria-label="Your sales" style={{ marginTop: "2rem" }}>
          <h2>Your sales</h2>
          {orders.length === 0 ? (
            <p>No sales yet.</p>
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
        </section>
      </main>
    </>
  );
}
