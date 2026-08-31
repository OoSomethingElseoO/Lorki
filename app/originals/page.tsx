import { OriginalsGrid } from "@/components/originals-grid";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { Pagination } from "@/components/pagination";
import { getLiveArtworksByKind } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/auth";

type OriginalsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function OriginalsPage({ searchParams }: OriginalsPageProps) {
  const { page } = await searchParams;
  const [{ items, totalPages, page: currentPage }, customer] = await Promise.all([
    getLiveArtworksByKind("ORIGINAL", Number(page)),
    getCurrentUser(),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Originals</PageTitle>
        <OriginalsGrid artworks={items} customerEmail={customer?.email} />
        {items.length === 0 ? <p className="centered-copy">No originals available right now.</p> : null}
        <Pagination page={currentPage} totalPages={totalPages} basePath="/originals" />
      </main>
      <Footer />
    </>
  );
}
