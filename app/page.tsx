import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getLiveArtworksByKind } from "@/lib/storefront";
import { getBranding, getSettings } from "@/lib/settings";

// Admin-editable content (branding, live inventory) must never be frozen at
// build time — force this to render per-request so /admin/settings changes
// show up immediately instead of only after the next deploy.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [{ items: originals, totalCount }, branding, settings] = await Promise.all([
    getLiveArtworksByKind("ORIGINAL"),
    getBranding(),
    getSettings(),
  ]);
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
          <h1 className="sr-only" id="home-title">
            {branding.siteName}
          </h1>
          <div className="hero__content">
            <img className="hero__artwork" src={heroImage} alt={heroAlt} />
          </div>
        </section>

        <section className="originals" id="originals" aria-labelledby="originals-title">
          <div className="originals__sticky-bar">
            <p className="site-wordmark" id="originals-title">
              {branding.siteName}
            </p>
          </div>
          <div className="originals__body">
            <h2>Originals</h2>
            {featured ? (
              <p>
                <strong>{featured.title}</strong> by {featured.artistName} — ${(featured.priceCents / 100).toFixed(2)}.{" "}
                {totalCount > 1 ? `${totalCount} originals available now.` : null}
              </p>
            ) : (
              <p>New originals are on the way — check back soon.</p>
            )}
            <Link href="/originals" className="button-link">
              Browse originals
            </Link>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <p>&copy; 2026 {branding.siteName}</p>
      </footer>
    </>
  );
}
