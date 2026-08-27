"use client";

import { useState } from "react";
import { CardStack, type CardStackItem } from "@/components/ui/card-stack";
import { ArtistLightbox } from "@/components/artist-lightbox";

export type ShowcaseArtist = {
  slug: string;
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
};

type ArtistsShowcaseProps = {
  artists: ShowcaseArtist[];
};

// Bridges CardStack (reports an index + click rect via onSelect) to the
// lightbox (wants the full artist + that rect) — mirrors OriginalsShowcase's
// relationship between RotundaCarousel/RotundaSlide and ArtworkLightbox.
export function ArtistsShowcase({ artists }: ArtistsShowcaseProps) {
  // Index, not the artist object itself — Next/Previous walk this same
  // bounded `artists` array (the homepage's own preview, capped at 9 by
  // page.tsx's `.slice(0, 9)`; the full roster lives on the paginated
  // /artists route instead).
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [originRect, setOriginRect] = useState<DOMRect | null>(null);

  const items: CardStackItem[] = artists.map((artist) => ({
    id: artist.slug,
    title: artist.name,
    description: `${artist.country} — ${artist.bio}`,
    imageSrc: artist.imageUrl,
    href: `/artists/${artist.slug}`,
  }));

  const hasMultiple = artists.length > 1;

  return (
    <>
      <CardStack
        items={items}
        showDots={items.length > 1}
        className="mt-8"
        onSelect={(index, rect) => {
          setSelectedIndex(index);
          setOriginRect(rect);
        }}
      />
      <ArtistLightbox
        artist={selectedIndex !== null ? artists[selectedIndex] : null}
        originRect={originRect}
        onClose={() => setSelectedIndex(null)}
        onNext={
          hasMultiple ? () => setSelectedIndex((i) => (i === null ? null : (i + 1) % artists.length)) : undefined
        }
        onPrevious={
          hasMultiple
            ? () => setSelectedIndex((i) => (i === null ? null : (i - 1 + artists.length) % artists.length))
            : undefined
        }
      />
    </>
  );
}
