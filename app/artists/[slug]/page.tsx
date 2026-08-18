import { notFound } from "next/navigation";
import { ArtistGallery } from "@/components/artist-gallery";
import { SiteHeader } from "@/components/site-header";
import { artists, getArtistBySlug, getArtworksByArtist } from "@/data/site-data";

type ArtistPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export function generateStaticParams() {
  return artists.map((artist) => ({ slug: artist.slug }));
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = getArtistBySlug(slug);

  if (!artist) {
    notFound();
  }

  const artistArtworks = getArtworksByArtist(artist.slug);

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <section className="artist-profile" aria-labelledby="artist-name">
          <img
            src={artist.image}
            alt={`Portrait placeholder for artist ${artist.name}.`}
            className="artist-profile__image"
          />
          <div className="artist-profile__content">
            <h1 id="artist-name">{artist.name}</h1>
            <p>
              <span className="detail-label">Age:</span> {artist.age}
            </p>
            <p>
              <span className="detail-label">Country:</span> {artist.country}
            </p>
            <p>{artist.bio}</p>
          </div>
        </section>
        <ArtistGallery artworks={artistArtworks} />
      </main>
    </>
  );
}
