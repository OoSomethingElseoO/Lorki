import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { getLiveArtworksByKind } from "@/lib/storefront";

export default async function OriginalsPage() {
  const artworks = await getLiveArtworksByKind("ORIGINAL");

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Originals</PageTitle>
        <section className="card-grid" aria-label="Original artwork">
          {artworks.map((artwork) => (
            <ArtworkCard artwork={artwork} key={artwork.id} />
          ))}
        </section>
        {artworks.length === 0 ? <p className="centered-copy">No originals available right now.</p> : null}
      </main>
    </>
  );
}
