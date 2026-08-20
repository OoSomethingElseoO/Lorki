import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import { getLiveArtworksByKind } from "@/lib/storefront";

type PrintsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function PrintsPage({ searchParams }: PrintsPageProps) {
  const { page } = await searchParams;
  const { items, totalPages, page: currentPage } = await getLiveArtworksByKind("PRINT", Number(page));

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Prints</PageTitle>
        <section className="card-grid" aria-label="Artwork prints">
          {items.map((artwork) => (
            <ArtworkCard artwork={artwork} key={artwork.id} />
          ))}
        </section>
        {items.length === 0 ? <p className="centered-copy">No prints available right now.</p> : null}
        <Pagination page={currentPage} totalPages={totalPages} basePath="/prints" />
      </main>
    </>
  );
}
