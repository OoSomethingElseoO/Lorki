import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistGallery } from "@/components/artist-gallery";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getArtistBySlug, getLiveArtworksForArtist } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/auth";

type ArtistPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

// This page already renders dynamically on every request (getCurrentUser()
// below forces that), so generateStaticParams achieved nothing except
// querying Postgres during `next build` — which is exactly what broke the
// Docker build on hosts (Render included) that don't pass secret env vars
// into the build step. Dropping it removes that dependency entirely;
// Next.js falls back to on-demand rendering (dynamicParams defaults true).
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
            <Link href="/artists" className={buttonVariants()} style={{ marginTop: "1rem" }}>
              Back to artists
            </Link>
          </div>
        </section>
        <ArtistGallery artworks={artistArtworks} customerEmail={customer?.email} />
      </main>
    </>
  );
}
