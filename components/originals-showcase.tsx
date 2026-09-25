"use client";

import { useState } from "react";
import { RotundaCarousel, type RotundaSlide } from "@/components/ui/rotunda-carousel";
import { SharedArtworkModal } from "@/components/shared-artwork-modal";
import type { StorefrontArtwork } from "@/lib/storefront";

type OriginalsShowcaseProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
};

// Owns rotunda selection and delegates both gallery paths to the same
// shared-image artwork surface.
export function OriginalsShowcase({ artworks, customerEmail }: OriginalsShowcaseProps) {
  // Index, not the artwork object itself — Next/Previous need to walk this
  // same bounded `artworks` array (the homepage's carousel preview, capped
  // at 24 by getCarouselArtworks — see that function's own comment; this
  // never touches the full catalog, which lives on the paginated
  // /originals route instead).
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const slides: RotundaSlide[] = artworks.map((artwork) => ({
    id: artwork.id,
    src: artwork.imageUrl,
    alt: artwork.altText,
    title: artwork.title,
    subtitle: artwork.artistName,
    artistHref: `/artists/${artwork.artistSlug}`,
    price: `$${(artwork.priceCents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  }));


  return (
    <>
      <RotundaCarousel
        slides={slides}
        label="Original artworks"
        speed={2.8}
          onSelect={(index) => {
            setSelectedIndex(index);
          }}
      />
      <SharedArtworkModal
        artwork={selectedIndex !== null ? artworks[selectedIndex] ?? null : null}
        onClose={() => setSelectedIndex(null)}
        customerEmail={customerEmail}
      />
    </>
  );
}
