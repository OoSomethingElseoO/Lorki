import { ArtworkCard } from "@/components/artwork-card";
import { ArtistCard } from "@/components/artist-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { SearchBox } from "@/components/search-box";
import { searchStorefront } from "@/lib/storefront";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const { q } = await searchParams;
  const query = q ?? "";
  const results = query.trim() ? await searchStorefront(query) : null;

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Search</PageTitle>

        <SearchBox defaultValue={query} />

        {results ? (
          <>
            {results.artworks.length > 0 ? (
              <section aria-label="Matching artwork">
                <h2>Artwork</h2>
                <div className="card-grid">
                  {results.artworks.map((artwork) => (
                    <ArtworkCard artwork={artwork} key={artwork.id} />
                  ))}
                </div>
              </section>
            ) : null}

            {results.artists.length > 0 ? (
              <section aria-label="Matching artists">
                <h2>Artists</h2>
                <div className="card-grid">
                  {results.artists.map((artist) => (
                    <ArtistCard artist={artist} key={artist.slug} />
                  ))}
                </div>
              </section>
            ) : null}

            {results.artworks.length === 0 && results.artists.length === 0 ? (
              <p className="centered-copy">No results for &ldquo;{query}&rdquo;.</p>
            ) : null}
          </>
        ) : (
          <p className="centered-copy">Search for an artist name or artwork title.</p>
        )}
      </main>
      <Footer />
    </>
  );
}
