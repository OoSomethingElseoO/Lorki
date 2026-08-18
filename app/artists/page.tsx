import { ArtistCard } from "@/components/artist-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { artists } from "@/data/site-data";

export default function ArtistsPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Artists</PageTitle>
        <section className="card-grid" aria-label="Artist directory">
          {artists.map((artist) => (
            <ArtistCard artist={artist} key={artist.slug} />
          ))}
        </section>
      </main>
    </>
  );
}
