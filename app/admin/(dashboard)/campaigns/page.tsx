import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaign-form";
import { CampaignStatusControl } from "@/components/admin/campaign-status-control";
import { ArtworkForm } from "@/components/admin/artwork-form";
import { ArtworkRow } from "@/components/admin/artwork-row";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/pagination";
import { getCampaignLabel } from "@/lib/campaigns";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminCampaignsPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { slug: { contains: query, mode: "insensitive" as const } },
          { artist: { name: { contains: query, mode: "insensitive" as const } } },
          { animal: { name: { contains: query, mode: "insensitive" as const } } },
          { conservancy: { name: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [campaigns, totalCount, animals, conservancies, artists] = await Promise.all([
    prisma.campaign.findMany({
      where,
      include: { animal: true, conservancy: true, artist: true, artworks: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.campaign.count({ where }),
    prisma.animal.findMany({ orderBy: { name: "asc" } }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
    prisma.artist.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Campaigns</h1>
      <CampaignForm animals={animals} conservancies={conservancies} artists={artists} />

      <AdminSearchForm placeholder="Search by artist, animal, or cause name" defaultValue={query} />

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

      {campaigns.length === 0 ? <p>{query ? `No campaigns match "${query}".` : "No campaigns yet."}</p> : null}

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/campaigns"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
