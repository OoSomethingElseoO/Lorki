import { redirect } from "next/navigation";
import { HeartHandshake } from "lucide-react";
import { CauseSettingsPanel } from "@/components/cause-settings-panel";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recommendPayoutChannel } from "@/lib/payout-recommendations";
import { getCampaignLabel } from "@/lib/campaigns";
import { statusBadgeClass } from "@/lib/status-badge";

export const dynamic = "force-dynamic";

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default async function CauseProfilePage() {
  const currentUser = await getCurrentUser();
  const cause = currentUser?.conservancy;
  if (!cause) {
    redirect("/login");
  }

  // A campaign supports this conservancy either directly (a cause picked
  // with no specific animal involved) or via an Animal that belongs to it
  // — see getCampaignConservancyId in lib/payouts.ts, which resolves the
  // same either/or for the payout side of this same relationship.
  const [campaigns, payouts] = await Promise.all([
    prisma.campaign.findMany({
      where: { OR: [{ conservancyId: cause.id }, { animal: { conservancyId: cause.id } }] },
      include: { animal: true, conservancy: true, artist: true, artworks: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payout.findMany({ where: { recipientType: "CONSERVANCY", recipientId: cause.id } }),
  ]);

  const releasedCents = payouts.filter((p) => p.status === "RELEASED").reduce((sum, p) => sum + p.amountCents, 0);
  const pendingCents = payouts.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <h1>Your Cause</h1>
      <p className="admin-form__hint">
        {cause.verifiedAt
          ? `Verified on ${new Date(cause.verifiedAt).toLocaleDateString()} — artists can select your cause for new campaigns.`
          : "Not verified yet — an admin needs to review your registration details before artists can select your cause for new campaigns."}
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
          <span className="impact-totals__value">{payouts.length}</span>
          <span className="impact-totals__label">Total sales</span>
        </div>
      </section>

      <Card variant="brand" className="mt-8 mb-8">
        <CardHeader>
          <CardTitle>Campaigns supporting you</CardTitle>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <EmptyState
              icon={<HeartHandshake />}
              title="No campaigns yet"
              description="Once an artist picks your cause for a new campaign, it'll show up here."
            />
          ) : (
            <div className="campaign-list">
              {campaigns.map((campaign) => (
                <article className="campaign-card" key={campaign.id}>
                  <h3>
                    {campaign.artist.name}
                    {campaign.status !== "LIVE" ? (
                      <>
                        {" "}
                        <span className={statusBadgeClass(campaign.status)}>{campaign.status}</span>
                      </>
                    ) : null}
                  </h3>
                  <p>
                    <span className="detail-label">Campaign:</span> {getCampaignLabel(campaign)}
                  </p>
                  <p className="campaign-card__split">
                    <span>{campaign.artistPercent}% artist</span>
                    <span>{campaign.conservancyPercent}% you</span>
                    <span>{campaign.operationsPercent}% operations</span>
                  </p>
                  <p>{campaign.artworks.length} listing(s)</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CauseSettingsPanel cause={cause} recommendation={recommendPayoutChannel(cause.region)} />
    </>
  );
}
