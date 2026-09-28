"use client";

import { useState } from "react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { PrintRack } from "@/components/ui/print-rack";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { FallbackImage } from "@/components/ui/fallback-image";
import { PrintVariantPicker } from "@/components/print-variant-picker";

type PrintsShowcaseProps = {
  prints: StorefrontArtwork[];
  customerEmail?: string;
};

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

// Prints are a shop, not a gallery wall — reproductions at a lower price
// point, meant to be browsed side by side and bought outright (BuyButton,
// never InquiryForm; unlike Originals, a print's "kind" is never anything
// else). The rack (components/ui/print-rack.tsx) owns the shelf layout and
// motion; this component just supplies what goes on each tile — an image
// with a visible price tag, title/artist, and the buy action — plus a
// single shared enlarge modal (same one-lightbox-for-the-row shape as
// ArtistGallery, since prints don't need Next/Previous browsing the way
// the Originals/Artists lightboxes do).
export function PrintsShowcase({ prints, customerEmail }: PrintsShowcaseProps) {
  const [enlarged, setEnlarged] = useState<StorefrontArtwork | null>(null);
  const [variantIds, setVariantIds] = useState<Record<string, string>>({});

  function selectedVariant(artwork: StorefrontArtwork) {
    const id = variantIds[artwork.id] ?? artwork.printVariants[0]?.id;
    return artwork.printVariants.find((variant) => variant.id === id);
  }

  return (
    <>
      <PrintRack
        items={prints}
        label="Prints for sale"
        renderItem={(artwork) => (
          <article className="print-tile">
            <button
              type="button"
              className="print-tile__frame"
              aria-label={`Enlarge ${artwork.title}`}
              onClick={() => setEnlarged(artwork)}
            >
              <FallbackImage
                src={artwork.imageUrl}
                alt={artwork.altText}
                className="print-tile__image"
                loading="lazy"
                decoding="async"
              />
              <span className="print-tile__tag">{formatDollars(selectedVariant(artwork)?.priceCents ?? artwork.priceCents)}</span>
            </button>
            <div className="print-tile__body">
              <h3 className="print-tile__title">{artwork.title}</h3>
              <p className="print-tile__artist">{artwork.artistName}</p>
              <PrintVariantPicker variants={artwork.printVariants} value={variantIds[artwork.id] ?? artwork.printVariants[0]?.id ?? ""} onChange={(id) => setVariantIds((current) => ({ ...current, [artwork.id]: id }))} />
              <BuyButton artworkId={artwork.id} variantId={selectedVariant(artwork)?.id} title={artwork.title} priceCents={selectedVariant(artwork)?.priceCents ?? artwork.priceCents} customerEmail={customerEmail} />
            </div>
          </article>
        )}
      />

      <AccessibleModal
        title={enlarged?.title ?? "Print preview"}
        isOpen={enlarged !== null}
        onClose={() => setEnlarged(null)}
        closeLabel="Close enlarged print"
      >
        {enlarged ? (
          <div className="modal-artwork">
            <FallbackImage src={enlarged.imageUrl} alt={enlarged.altText} />
            <PrintVariantPicker variants={enlarged.printVariants} value={variantIds[enlarged.id] ?? enlarged.printVariants[0]?.id ?? ""} onChange={(id) => setVariantIds((current) => ({ ...current, [enlarged.id]: id }))} />
            <BuyButton artworkId={enlarged.id} variantId={selectedVariant(enlarged)?.id} title={enlarged.title} priceCents={selectedVariant(enlarged)?.priceCents ?? enlarged.priceCents} customerEmail={customerEmail} />
          </div>
        ) : null}
      </AccessibleModal>
    </>
  );
}
