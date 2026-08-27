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
  const [selected, setSelected] = useState<{ artwork: StorefrontArtwork; originRect: DOMRect } | null>(null);

  const slides: RotundaSlide[] = artworks.map((artwork) => ({
    id: artwork.id,
    src: artwork.imageUrl,
    alt: artwork.altText,
    title: artwork.title,
    subtitle: artwork.artistName,
  }));

  return (
    <>
      <RotundaCarousel
        slides={slides}
        label="Original artworks"
        onSelect={(index, originRect) => setSelected({ artwork: artworks[index], originRect })}
      />
      <ArtworkLightbox
        artwork={selected?.artwork ?? null}
        originRect={selected?.originRect ?? null}
        onClose={() => setSelected(null)}
        customerEmail={customerEmail}
      />
    </>
  );
}
