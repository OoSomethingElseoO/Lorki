import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getLiveArtworksByKind } from "@/lib/storefront";

export default async function Home() {
  const originals = await getLiveArtworksByKind("ORIGINAL");
  const featured = originals[0];

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="home-title">
          <h1 className="sr-only" id="home-title">
            Aurelia Originals
          </h1>
          <div className="hero__content">
            <img
              className="hero__artwork"
              src={featured?.imageUrl ?? "/artwork/featured-original.png"}
              alt={featured?.altText ?? "Original artwork, part of the Aurelia Originals collection."}
            />
          </div>
        </section>

        <section className="originals" id="originals" aria-labelledby="originals-title">
          <div className="originals__sticky-bar">
            <p className="site-wordmark" id="originals-title">
              Aurelia Originals
            </p>
          </div>
          <div className="originals__body">
            <h2>Originals</h2>
            {featured ? (
              <p>
                <strong>{featured.title}</strong> by {featured.artistName} — ${(featured.priceCents / 100).toFixed(2)}.{" "}
                {originals.length > 1 ? `${originals.length} originals available now.` : null}
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
        <p>&copy; 2026 Aurelia Originals</p>
      </footer>
    </>
  );
}
