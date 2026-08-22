import { notFound } from "next/navigation";
import { ArtistGallery } from "@/components/artist-gallery";
import { SiteHeader } from "@/components/site-header";
import { getArtistBySlug, getLiveArtworksForArtist } from "@/lib/storefront";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

type ArtistPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateStaticParams() {
  const artists = await prisma.artist.findMany({ select: { slug: true } });
  return artists.map((artist) => ({ slug: artist.slug }));
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) {
    notFound();
  }

  const [artistArtworks, customer] = await Promise.all([
    getLiveArtworksForArtist(artist.id),
    getCurrentUser(),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <section className="artist-profile" aria-labelledby="artist-name">
          <img
            src={artist.imageUrl}
            alt={`Portrait placeholder for artist ${artist.name}.`}
            className="artist-profile__image"
          />
          <div className="artist-profile__content">
            <h1 id="artist-name">{artist.name}</h1>
            <p>
              <span className="detail-label">Country:</span> {artist.country}
            </p>
            <p>{artist.bio}</p>
            {artist.socialLinks.length > 0 ? (
              <ul className="artist-profile__social-links">
                {artist.socialLinks.map((link) => (
                  <li key={link.id}>
                    <a href={link.url} target="_blank" rel="noreferrer">
                      {link.platform}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
        <ArtistGallery artworks={artistArtworks} customerEmail={customer?.email} />
      </main>
    </>
  );
}
