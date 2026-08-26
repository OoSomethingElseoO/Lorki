import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArtworkCard } from "@/components/artwork-card";
import { ArtistCard } from "@/components/artist-card";
import { NewsCard } from "@/components/news-card";
import { Reveal } from "@/components/reveal";
import {
  getArtists,
  getImpactTotals,
  getLiveArtworksByKind,
  getLiveNewsArticles,
} from "@/lib/storefront";
import { getBranding, getSettings } from "@/lib/settings";
import { getCurrentUser } from "@/lib/auth";

function formatDollars(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Admin-editable content (branding, live inventory, impact totals) must
// never be frozen at build time — force this to render per-request so
// /admin/settings changes and new sales show up immediately.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [originalsResult, printsResult, artistsResult, newsArticles, impact, branding, settings, customer] =
    await Promise.all([
      getLiveArtworksByKind("ORIGINAL"),
      getLiveArtworksByKind("PRINT"),
      getArtists(),
      getLiveNewsArticles(),
      getImpactTotals(),
      getBranding(),
      getSettings(),
      getCurrentUser(),
    ]);

  const originals = originalsResult.items;
  const prints = printsResult.items.slice(0, 3);
  const artists = artistsResult.items.slice(0, 4);
  const news = newsArticles.slice(0, 3);
  const featured = originals[0];

  // An admin-chosen hero image always wins; otherwise show whatever's
  // actually for sale right now rather than a generic placeholder.
  const heroImage = settings.heroImageUrl || featured?.imageUrl || branding.heroImageUrl;
  const heroAlt = settings.heroImageUrl ? branding.heroAlt : (featured?.altText ?? branding.heroAlt);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="home-title">
          <div className="hero__content">
            <div className="hero__copy">
              <span className="hero__eyebrow">Original art, real impact</span>
              <h1 className="hero__title" id="home-title">
                {branding.siteName}
              </h1>
              <p className="hero__tagline">{branding.heroTagline}</p>
              <div className="hero__actions">
                <Link href="/originals" className={buttonVariants()}>
                  Browse originals
                </Link>
                <Link href="/impact" className="hero__actions-link">
                  See where the money goes
                </Link>
              </div>
            </div>
            <div className="hero__frame">
              <img className="hero__artwork" src={heroImage} alt={heroAlt} />
            </div>
          </div>
        </section>

        <Reveal>
          <section className="home-section" aria-label="Originals">
            <div className="home-section__intro">
              <h2>Originals</h2>
              {featured ? (
                <p>
                  <strong>{featured.title}</strong> by {featured.artistName} — ${(featured.priceCents / 100).toFixed(2)}.{" "}
                  {originalsResult.totalCount > 1 ? `${originalsResult.totalCount} originals available now.` : null}
                </p>
              ) : (
                <p>New originals are on the way — check back soon.</p>
              )}
            </div>
            {originals.length > 0 ? (
              <>
                <div className="card-grid">
                  {originals.slice(0, 3).map((artwork) => (
                    <ArtworkCard artwork={artwork} customerEmail={customer?.email} key={artwork.id} />
                  ))}
                </div>
                <Link href="/originals" className={cn(buttonVariants(), "block w-fit mx-auto")}>
                  {originalsResult.totalCount > 3 ? "View all originals" : "Browse originals"}
                </Link>
              </>
            ) : null}
          </section>
        </Reveal>

        <Reveal>
          <section className="home-section home-section--impact home-section--alt" aria-label="Impact so far">
            <div className="home-section__intro">
              <h2>Where the money goes</h2>
              <p>
                Every piece sold pays the artist who made it and funds the conservancy protecting the animal it
                depicts. These numbers are money that has actually been paid out, not just collected.
              </p>
            </div>
            <div className="impact-totals">
              <div className="impact-totals__stat">
                <span className="impact-totals__value">{formatDollars(impact.artistCents)}</span>
                <span className="impact-totals__label">Paid to artists</span>
              </div>
              <div className="impact-totals__stat">
                <span className="impact-totals__value">{formatDollars(impact.conservancyCents)}</span>
                <span className="impact-totals__label">Paid to conservancies</span>
              </div>
              <div className="impact-totals__stat">
                <span className="impact-totals__value">{impact.piecesSold}</span>
                <span className="impact-totals__label">Pieces sold</span>
              </div>
            </div>
            <Link href="/impact" className={cn(buttonVariants(), "block w-fit mx-auto")}>
              See the full breakdown
            </Link>
          </section>
        </Reveal>

        {artists.length > 0 ? (
          <Reveal>
            <section className="home-section" aria-label="Meet the artists">
              <div className="home-section__intro">
                <h2>Meet the artists</h2>
                <p>Every piece is painted by an artist local to the animal it depicts.</p>
              </div>
              <div className="card-grid">
                {artists.map((artist) => (
                  <ArtistCard artist={artist} key={artist.slug} />
                ))}
              </div>
              <Link href="/artists" className={cn(buttonVariants(), "block w-fit mx-auto")}>
                View all artists
              </Link>
            </section>
          </Reveal>
        ) : null}

        {prints.length > 0 ? (
          <Reveal>
            <section className="home-section home-section--alt" aria-label="Prints">
              <div className="home-section__intro">
                <h2>Prints, from {formatDollars(Math.min(...prints.map((p) => p.priceCents)))}</h2>
                <p>The same artwork, reprinted at a lower price — a smaller way to support the same cause.</p>
              </div>
              <div className="card-grid">
                {prints.map((artwork) => (
                  <ArtworkCard artwork={artwork} customerEmail={customer?.email} key={artwork.id} />
                ))}
              </div>
              <Link href="/prints" className={cn(buttonVariants(), "block w-fit mx-auto")}>
                Shop prints
              </Link>
            </section>
          </Reveal>
        ) : null}

        {news.length > 0 ? (
          <Reveal>
            <section className="home-section" aria-label="Latest news">
              <div className="home-section__intro">
                <h2>Studio notes</h2>
                <p>Updates from the artists and the conservancies they work with.</p>
              </div>
              <div className="news-list">
                {news.map((article) => (
                  <NewsCard article={article} key={article.id} />
                ))}
              </div>
              <Link href="/news" className={cn(buttonVariants(), "block w-fit mx-auto")}>
                Read more news
              </Link>
            </section>
          </Reveal>
        ) : null}
      </main>
      <footer className="site-footer">
        <p>&copy; 2026 {branding.siteName}</p>
      </footer>
    </>
  );
}
