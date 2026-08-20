import { ArtistCard } from "@/components/artist-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { getArtists } from "@/lib/storefront";

export default async function ArtistsPage() {
  const artists = await getArtists();

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
        {artists.length === 0 ? <p className="centered-copy">No artists listed yet.</p> : null}
      </main>
    </>
  );
}
