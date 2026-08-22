import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaign-form";
import { CampaignStatusControl } from "@/components/admin/campaign-status-control";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { ArtworkRow } from "@/components/admin/artwork-row";
import { DeleteButton } from "@/components/admin/delete-button";
import { getCampaignLabel } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  const [campaigns, animals, conservancies, artists] = await Promise.all([
    prisma.campaign.findMany({
      include: { animal: true, conservancy: true, artist: true, artworks: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.animal.findMany({ orderBy: { name: "asc" } }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
    prisma.artist.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Campaigns</h1>
      <CampaignForm animals={animals} conservancies={conservancies} artists={artists} />

      {campaigns.map((campaign) => (
        <section className="admin-campaign-card" key={campaign.id}>
          <header>
            <h2>{getCampaignLabel(campaign)}</h2>
            <div className="admin-campaign-card__controls">
              <Link href={`/admin/campaigns/${campaign.id}/edit`} className="admin-table__link-button">
                Edit
              </Link>
              <CampaignStatusControl campaignId={campaign.id} status={campaign.status} />
              <DeleteButton
                endpoint={`/api/admin/campaigns/${campaign.id}`}
                confirmLabel={getCampaignLabel(campaign)}
              />
            </div>
          </header>
          <p className="admin-form__hint">
            Split: {campaign.artistPercent}% artist / {campaign.conservancyPercent}% conservancy /{" "}
            {campaign.operationsPercent}% operations
          </p>

          <table className="admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Kind</th>
                <th>Price</th>
                <th>Inventory</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaign.artworks.map((artwork) => (
                <ArtworkRow campaignId={campaign.id} artwork={artwork} key={artwork.id} />
              ))}
              {campaign.artworks.length === 0 ? (
                <tr>
                  <td colSpan={5}>No artworks yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <ArtworkForm campaignId={campaign.id} />
        </section>
      ))}

      {campaigns.length === 0 ? <p>No campaigns yet.</p> : null}
    </>
  );
}
