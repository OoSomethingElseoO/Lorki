import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { getLiveArtworksByKind } from "@/lib/storefront";

export default async function PrintsPage() {
  const artworks = await getLiveArtworksByKind("PRINT");

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Prints</PageTitle>
        <section className="card-grid" aria-label="Artwork prints">
          {artworks.map((artwork) => (
            <ArtworkCard artwork={artwork} key={artwork.id} />
          ))}
        </section>
        {artworks.length === 0 ? <p className="centered-copy">No prints available right now.</p> : null}
      </main>
    </>
  );
}
