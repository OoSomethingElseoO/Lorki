import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaign-form";
import { CampaignStatusControl } from "@/components/admin/campaign-status-control";
import { AddArtworkToggle } from "@/components/admin/add-artwork-toggle";
import { CampaignArtworkTable } from "@/components/admin/campaign-artwork-table";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { EditIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
      <Tabs defaultValue="campaigns">
        <TabsList aria-label="Campaign sections">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="add">Add campaign</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns">
          <AdminSearchForm placeholder="Search by artist, animal, or cause name" defaultValue={query} />

          {campaigns.map((campaign) => (
            <section className="admin-campaign-card" key={campaign.id}>
              <header>
                <h2>{getCampaignLabel(campaign)}</h2>
                <div className="admin-campaign-card__controls">
                  <Link href={`/admin/campaigns/${campaign.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    <EditIcon />
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

              <CampaignArtworkTable campaignId={campaign.id} artworks={campaign.artworks} />

              <AddArtworkToggle campaignId={campaign.id} />
            </section>
          ))}

          {campaigns.length === 0 ? (
            <EmptyState
              message={query ? `No campaigns match "${query}".` : "No campaigns yet."}
              hint={query ? "Try a different search term." : "Use the Add campaign tab to add your first campaign."}
            />
          ) : null}

          <Pagination
            page={currentPage}
            totalPages={adminTotalPages(totalCount)}
            basePath="/admin/campaigns"
            extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
          />
        </TabsContent>

        <TabsContent value="add">
          <CampaignForm animals={animals} conservancies={conservancies} artists={artists} />
        </TabsContent>
      </Tabs>
    </>
  );
}
