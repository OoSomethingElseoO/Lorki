import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistGallery } from "@/components/artist-gallery";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { getArtistBySlug, getLiveArtworksForArtist } from "@/lib/storefront";
import { getCurrentUser } from "@/lib/auth";
import { FallbackImage } from "@/components/ui/fallback-image";
import { ShareButton } from "@/components/share-button";
import { absoluteOrRelative, publicMetadata, imageUrlForSchema } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";
import { ArtistCountryMap } from "@/components/artist-country-map";

type ArtistPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: ArtistPageProps) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);
  if (!artist) return {};
  return publicMetadata({
    title: `${artist.name} | Lorki Originals`,
    description: artist.bio || `Explore original artwork by ${artist.name}.`,
    pathname: `/artists/${encodeURIComponent(artist.slug)}`,
    image: artist.imageUrl,
  });
}

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
        <StructuredData data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          name: `${artist.name} — Artist`,
          description: artist.bio,
          url: absoluteOrRelative(`/artists/${artist.slug}`),
          mainEntity: {
            "@type": "Person",
            name: artist.name,
            description: artist.bio,
            image: imageUrlForSchema(artist.imageUrl),
            homeLocation: artist.country ? { "@type": "Place", name: artist.country } : undefined,
            sameAs: artist.socialLinks.map((link) => link.url),
          },
        }} />
        <section className="artist-profile" aria-labelledby="artist-name">
          <FallbackImage
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
            {artist.story ? (
              <div className="artist-profile__story">
                <h2>My story</h2>
                <p>{artist.story}</p>
              </div>
            ) : null}
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
            <ShareButton
              title={`${artist.name} — Lorki Originals`}
              text={`View ${artist.name}'s artwork on Lorki Originals.`}
              targetType="artist"
              targetId={artist.id}
              className="artist-profile__share"
            />
          </div>
          <ArtistCountryMap country={artist.country} countryCode={artist.countryCode} />
        </section>
        <ArtistGallery artworks={artistArtworks} customerEmail={customer?.email} />
      </main>
      <Footer />
    </>
  );
}
