import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { artworks } from "@/data/site-data";

export default function OriginalsPage() {
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
      </main>
    </>
  );
}
