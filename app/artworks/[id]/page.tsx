import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/footer";
import { SiteHeader } from "@/components/site-header";
import { InquiryForm } from "@/components/inquiry-form";
import { BuyButton } from "@/components/buy-button";
import { ShareButton } from "@/components/share-button";
import { FallbackImage } from "@/components/ui/fallback-image";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getPublicArtworkById } from "@/lib/storefront";

type ArtworkPageProps = { params: Promise<{ id: string }> };

export default async function ArtworkPage({ params }: ArtworkPageProps) {
  const { id } = await params;
  const [artwork, customer] = await Promise.all([getPublicArtworkById(id), getCurrentUser()]);
  if (!artwork) notFound();

  return (
    <>
      <SiteHeader />
      <main className="page-main artwork-page" id="main-content">
        <Link href={`/artists/${artwork.artistSlug}`} className={buttonVariants({ variant: "outline" })}>
          View artist
        </Link>
        <section className="artwork-page__content" aria-labelledby="artwork-title">
          <FallbackImage src={artwork.imageUrl} alt={artwork.altText} className="artwork-page__image" />
          <div className="artwork-page__details">
            <p className="detail-label">{artwork.kind === "ORIGINAL" ? "Original artwork" : "Print"}</p>
            <h1 id="artwork-title">{artwork.title}</h1>
            <p className="text-muted">{artwork.artistName} · {artwork.artistCountry}</p>
            <p className="artwork-page__price">${(artwork.priceCents / 100).toFixed(2)}</p>
            {artwork.story ? <p className="whitespace-pre-line leading-relaxed">{artwork.story}</p> : null}
            <div className="artwork-page__actions">
              <ShareButton title={`${artwork.title} — Lorki Originals`} text={`View ${artwork.title} by ${artwork.artistName}.`} />
            {artwork.inventoryState !== "AVAILABLE" ? (
              <p className="text-muted">
                {artwork.inventoryState === "SOLD" ? "This artwork has been sold." : "This artwork is currently reserved."}
              </p>
            ) : artwork.kind === "ORIGINAL" ? (
                <InquiryForm artworkId={artwork.id} title={artwork.title} customerEmail={customer?.email} />
              ) : (
                <BuyButton artworkId={artwork.id} title={artwork.title} priceCents={artwork.priceCents} customerEmail={customer?.email} />
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
