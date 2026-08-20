import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { prisma } from "@/lib/prisma";

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Payout totals change every time an order ships — never freeze this at
// build time, same reasoning as the branding pages.
export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const [released, piecesSold, campaigns] = await Promise.all([
    prisma.payout.groupBy({
      by: ["recipientType"],
      where: { status: "RELEASED" },
      _sum: { amountCents: true },
    }),
    prisma.artwork.count({ where: { inventoryState: "SOLD" } }),
    prisma.campaign.findMany({
      where: { status: "LIVE" },
      include: { animal: { include: { conservancy: true } }, artist: true },
    }),
  ]);

  const totals = { artistCents: 0, conservancyCents: 0, operationsCents: 0 };
  for (const row of released) {
    const cents = row._sum.amountCents ?? 0;
    if (row.recipientType === "ARTIST") totals.artistCents = cents;
    if (row.recipientType === "CONSERVANCY") totals.conservancyCents = cents;
    if (row.recipientType === "OPERATIONS") totals.operationsCents = cents;
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Impact</PageTitle>
        <section className="centered-copy" aria-label="How sales are split">
          <p>
            Every original and print sold funds three things at once: the artist who made it, the
            conservancy protecting the animal it depicts, and the operations that keep this site running.
            Numbers below reflect money that has actually been paid out, not just collected.
          </p>
        </section>

        <section className="impact-totals" aria-label="Totals paid out">
          <div className="impact-totals__stat">
            <span className="impact-totals__value">{formatDollars(totals.artistCents)}</span>
            <span className="impact-totals__label">Paid to artists</span>
          </div>
          <div className="impact-totals__stat">
            <span className="impact-totals__value">{formatDollars(totals.conservancyCents)}</span>
            <span className="impact-totals__label">Paid to conservancies</span>
          </div>
          <div className="impact-totals__stat">
            <span className="impact-totals__value">{piecesSold}</span>
            <span className="impact-totals__label">Pieces sold</span>
          </div>
        </section>

        <section className="campaign-list" aria-label="Active campaigns">
          {campaigns.map((campaign) => (
            <article className="campaign-card" key={campaign.id}>
              <h2>
                {campaign.animal.name} &times; {campaign.artist.name}
              </h2>
              <p>
                <span className="detail-label">Conservancy partner:</span> {campaign.animal.conservancy.name} (
                {campaign.animal.conservancy.region})
              </p>
              <p className="campaign-card__split">
                <span>{campaign.artistPercent}% artist</span>
                <span>{campaign.conservancyPercent}% conservancy</span>
                <span>{campaign.operationsPercent}% operations</span>
              </p>
            </article>
          ))}
          {campaigns.length === 0 ? <p>No campaigns are live yet.</p> : null}
        </section>
      </main>
    </>
  );
}
