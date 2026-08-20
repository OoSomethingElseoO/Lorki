import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import { getLiveArtworksByKind } from "@/lib/storefront";

type OriginalsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function OriginalsPage({ searchParams }: OriginalsPageProps) {
  const { page } = await searchParams;
  const { items, totalPages, page: currentPage } = await getLiveArtworksByKind("ORIGINAL", Number(page));

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Originals</PageTitle>
        <section className="card-grid" aria-label="Original artwork">
          {items.map((artwork) => (
            <ArtworkCard artwork={artwork} key={artwork.id} />
          ))}
        </section>
        {items.length === 0 ? <p className="centered-copy">No originals available right now.</p> : null}
        <Pagination page={currentPage} totalPages={totalPages} basePath="/originals" />
      </main>
    </>
  );
}
