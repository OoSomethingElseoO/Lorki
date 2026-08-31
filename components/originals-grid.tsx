"use client";

import { useState } from "react";
import { ArtworkCard } from "@/components/artwork-card";
import { ArtworkLightbox } from "@/components/artwork-lightbox";
import type { StorefrontArtwork } from "@/lib/storefront";

type OriginalsGridProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
};

// Same split as OriginalsShowcase (components/originals-showcase.tsx): the
// grid reports "clicked, here's the index + rect", this component owns the
// selection/originRect state and hands the resolved artwork to one shared
// ArtworkLightbox, wired for Next/Previous across the full `artworks` array.
export function OriginalsGrid({ artworks, customerEmail }: OriginalsGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

  const hasMultiple = artworks.length > 1;

  return (
    <>
      <section className="card-grid" aria-label="Original artwork">
        {artworks.map((artwork, index) => (
          <ArtworkCard
            artwork={artwork}
            customerEmail={customerEmail}
            key={artwork.id}
            onSelect={(rect) => {
              setSelectedIndex(index);
              setOriginRect(rect);
            }}
          />
        ))}
      </section>
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
