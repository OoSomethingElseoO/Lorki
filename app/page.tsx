import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { OriginalsShowcase } from "@/components/originals-showcase";
import { ArtistsShowcase } from "@/components/artists-showcase";
import { PrintsShowcase } from "@/components/prints-showcase";
import { cn } from "@/lib/utils";
import { NewsCard } from "@/components/news-card";
import { Reveal } from "@/components/reveal";
import { Hero, type HeroImage } from "@/components/hero";
import { TextBlockAnimation } from "@/components/ui/text-block-animation";
import {
  getArtists,
  getCarouselArtworks,
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
  const [originalsResult, printsResult, artistsResult, newsArticles, impact, branding, settings, customer, carouselArtworks] =
    await Promise.all([
      getLiveArtworksByKind("ORIGINAL"),
      getLiveArtworksByKind("PRINT"),
      getArtists(),
      getLiveNewsArticles(),
      getImpactTotals(),
      getBranding(),
      getSettings(),
      getCurrentUser(),
      getCarouselArtworks(),
    ]);

  const originals = originalsResult.items;
  // The rack (PrintsShowcase) is a horizontal browse-and-buy shelf, not a
  // fixed grid — it wants enough tiles to actually scroll through. Bumped
  // from 3 (the old plain-grid cap) toward the same generosity already
  // given to Artists (9); still just this preview's cap, the full catalog
  // lives on the paginated /prints route.
  const prints = printsResult.items.slice(0, 9);
  const artists = artistsResult.items.slice(0, 9);
  const news = newsArticles.slice(0, 3);
  const featured = originals[0];

  const artistShowcaseItems = artists.map((artist) => ({
    slug: artist.slug,
    name: artist.name,
    country: artist.country,
    bio: artist.bio,
    imageUrl: artist.imageUrl,
  }));

  // An admin-chosen hero image always wins — shown as a single static
  // image, no rotation. Otherwise rotate through whatever's actually for
  // sale right now (via the hero's slow crossfade) rather than a single
  // generic placeholder; a single live artwork or no live inventory at all
  // both naturally collapse to a one-entry array, which the hero also
  // renders statically.
  const heroImages: HeroImage[] = settings.heroImageUrl
    ? [{ src: settings.heroImageUrl, alt: branding.heroAlt }]
    : carouselArtworks.length > 0
      ? carouselArtworks
          .slice(0, 6)
          .map((artwork) => ({ src: artwork.imageUrl, alt: artwork.altText, artistName: artwork.artistName }))
      : [{ src: branding.heroImageUrl, alt: branding.heroAlt }];

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <Hero
          eyebrow="Original art, real impact"
          headline={branding.heroTagline}
          subline="Each piece funds the conservancy protecting its subject."
          images={heroImages}
        />

        <Reveal>
          <section className="home-section" aria-label="Originals">
            <div className="home-section__intro">
              <TextBlockAnimation blockColor="var(--gold)">
                <h2>Originals</h2>
              </TextBlockAnimation>
              {featured ? (
                <p>
                  <strong>{featured.title}</strong> by {featured.artistName} — ${(featured.priceCents / 100).toFixed(2)}.{" "}
                  {originalsResult.totalCount > 1 ? `${originalsResult.totalCount} originals available now.` : null}
                </p>
              ) : (
                <p>New originals are on the way — check back soon.</p>
              )}
            </div>
            {carouselArtworks.length > 0 ? (
              <>
                <OriginalsShowcase artworks={carouselArtworks} customerEmail={customer?.email} />
                <Link href="/originals" className={cn(buttonVariants(), "mt-8 block w-fit mx-auto")}>
                  {originalsResult.totalCount > carouselArtworks.length ? "View all originals" : "Browse originals"}
                </Link>
              </>
            ) : null}
          </section>
        </Reveal>

        <Reveal>
          <section className="home-section home-section--impact home-section--alt" aria-label="Impact so far">
            <div className="home-section__intro">
              <TextBlockAnimation blockColor="var(--teal)">
                <h2>Where the money goes</h2>
              </TextBlockAnimation>
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
                <TextBlockAnimation blockColor="var(--gold)">
                  <h2>Meet the artists</h2>
                </TextBlockAnimation>
                <p>Every piece is painted by an artist local to the animal it depicts.</p>
              </div>
              <ArtistsShowcase artists={artistShowcaseItems} />
              <Link href="/artists" className={cn(buttonVariants(), "mt-8 block w-fit mx-auto")}>
                View all artists
              </Link>
            </section>
          </Reveal>
        ) : null}

        {prints.length > 0 ? (
          <Reveal>
            <section className="home-section home-section--alt" aria-label="Prints">
              <div className="home-section__intro">
                <TextBlockAnimation blockColor="var(--gold)">
                  <h2>Prints, from {formatDollars(Math.min(...prints.map((p) => p.priceCents)))}</h2>
                </TextBlockAnimation>
                <p>The same artwork, reprinted at a lower price — a smaller way to support the same cause.</p>
              </div>
              <PrintsShowcase prints={prints} customerEmail={customer?.email} />
              <Link href="/prints" className={cn(buttonVariants(), "mt-8 block w-fit mx-auto")}>
                Shop prints
              </Link>
            </section>
          </Reveal>
        ) : null}

        {news.length > 0 ? (
          <Reveal>
            <section className="home-section" aria-label="Latest news">
              <div className="home-section__intro">
                <TextBlockAnimation blockColor="var(--gold)">
                  <h2>Studio notes</h2>
                </TextBlockAnimation>
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
      <Footer />
    </>
  );
}
