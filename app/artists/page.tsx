import { ArtistCard } from "@/components/artist-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Pagination } from "@/components/pagination";
import { getArtists } from "@/lib/storefront";

type ArtistsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function ArtistsPage({ searchParams }: ArtistsPageProps) {
  const { page } = await searchParams;
  const { items, totalPages, page: currentPage } = await getArtists(Number(page));

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Artists</PageTitle>
        <section className="card-grid" aria-label="Artist directory">
          {items.map((artist) => (
            <ArtistCard artist={artist} key={artist.slug} />
          ))}
        </section>
        {items.length === 0 ? <p className="centered-copy">No artists listed yet.</p> : null}
        <Pagination page={currentPage} totalPages={totalPages} basePath="/artists" />
      </main>
    </>
  );
}
