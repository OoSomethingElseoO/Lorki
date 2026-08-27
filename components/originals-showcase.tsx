"use client";

import { useState } from "react";
import { RotundaCarousel, type RotundaSlide } from "@/components/ui/rotunda-carousel";
import { ArtworkLightbox } from "@/components/artwork-lightbox";
import type { StorefrontArtwork } from "@/lib/storefront";

type OriginalsShowcaseProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
};

// Bridges the rotunda (reports an index + click rect) to the lightbox
// (wants the full artwork + that rect) — the two were built independently
// against a shared props contract, this is the only place that joins them.
export function OriginalsShowcase({ artworks, customerEmail }: OriginalsShowcaseProps) {
  // Index, not the artwork object itself — Next/Previous need to walk this
  // same bounded `artworks` array (the homepage's carousel preview, capped
  // at 24 by getCarouselArtworks — see that function's own comment; this
  // never touches the full catalog, which lives on the paginated
  // /originals route instead).
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

  const slides: RotundaSlide[] = artworks.map((artwork) => ({
    id: artwork.id,
    src: artwork.imageUrl,
    alt: artwork.altText,
    title: artwork.title,
    subtitle: artwork.artistName,
  }));

  const hasMultiple = artworks.length > 1;

  return (
    <>
      <RotundaCarousel
        slides={slides}
        label="Original artworks"
        onSelect={(index, rect) => {
          setSelectedIndex(index);
          setOriginRect(rect);
        }}
      />
      <ArtworkLightbox
        artwork={selectedIndex !== null ? artworks[selectedIndex] : null}
        originRect={originRect}
        onClose={() => setSelectedIndex(null)}
        customerEmail={customerEmail}
        onNext={
          hasMultiple ? () => setSelectedIndex((i) => (i === null ? null : (i + 1) % artworks.length)) : undefined
        }
        onPrevious={
          hasMultiple
            ? () => setSelectedIndex((i) => (i === null ? null : (i - 1 + artworks.length) % artworks.length))
            : undefined
        }
      />
    </>
  );
}
