"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleUserRound, ShoppingBag } from "lucide-react";
import { LayoutGrid } from "@/components/ui/layout-grid";
import { InquiryForm } from "@/components/inquiry-form";
import { SharedArtworkModal } from "@/components/shared-artwork-modal";
import type { StorefrontArtwork } from "@/lib/storefront";

type OriginalsGridProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
  initialPage: number;
  totalPages: number;
};

type ArtworkInstance = {
  artwork: StorefrontArtwork;
  displayId: string;
};

// Same split as OriginalsShowcase (components/originals-showcase.tsx): the
// grid reports "clicked, here's the index + rect", this component owns the
// selection/originRect state and hands the resolved artwork to one shared
// ArtworkLightbox, wired for Next/Previous across the full `artworks` array.
export function OriginalsGrid({ artworks: initialArtworks, customerEmail, initialPage, totalPages }: OriginalsGridProps) {
  const [artworks, setArtworks] = useState<ArtworkInstance[]>(() => initialArtworks.map((artwork) => ({ artwork, displayId: artwork.id })));
  const sourceArtworksRef = useRef(initialArtworks);
  const loopNumberRef = useRef(0);
  const [page, setPage] = useState(initialPage);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const hasMore = true;

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setLoadError(null);
        fetch(`/api/originals?page=${page + 1}`, { cache: "force-cache" })
          .then(async (response) => {
            if (!response.ok) throw new Error("Unable to load more originals");
            return response.json() as Promise<{ items: StorefrontArtwork[]; page: number }>;
          })
          .then((next) => {
            if (next.items.length === 0 || next.page >= totalPages) {
              loopNumberRef.current += 1;
              const loop = [...sourceArtworksRef.current].sort(() => Math.random() - 0.5);
              setArtworks((current) => [
                ...current,
                ...loop.map((artwork, index) => ({
                  artwork,
                  displayId: `${artwork.id}::loop-${loopNumberRef.current}-${index}`,
                })),
              ]);
            } else {
              setArtworks((current) => [
                ...current,
                ...next.items.map((artwork) => ({ artwork, displayId: artwork.id })),
              ]);
              sourceArtworksRef.current = [...sourceArtworksRef.current, ...next.items];
              setPage(next.page);
            }
          })
          .catch(() => setLoadError("More originals could not be loaded. Try again."))
          .finally(() => {
            loadingRef.current = false;
            setLoading(false);
          });
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const cards = artworks.map(({ artwork, displayId }) => ({
    id: displayId,
    thumbnail: artwork.imageUrl,
    alt: artwork.altText,
    topContent: (
      <>
        <span className="layout-grid__price">${(artwork.priceCents / 100).toFixed(2)}</span>
        <span className="layout-grid__buy-icon" aria-label="Buy artwork" title="Buy artwork"><ShoppingBag className="size-4" aria-hidden="true" /></span>
      </>
    ),
    hoverContent: (
      <>
        <strong>{artwork.title}</strong>
        <Link className="layout-grid__artist-link" href={`/artists/${artwork.artistSlug}`} onClick={(event) => event.stopPropagation()}>
          <CircleUserRound className="size-3.5" aria-hidden="true" />
          <span>{artwork.artistName}</span>
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </>
    ),
    content: (
      <div className="artwork-layout-details">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Original</p>
        <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink">{artwork.title}</h2>
        <p className="mt-2 text-muted">{artwork.artistName} · {artwork.artistCountry}</p>
        {artwork.story ? <p className="mt-5 whitespace-pre-line leading-relaxed text-ink">{artwork.story}</p> : null}
        <p className="mt-6 text-2xl font-bold text-ink">${(artwork.priceCents / 100).toFixed(2)}</p>
        <div className="mt-6 border-t-2 border-line pt-5">
          <InquiryForm artworkId={artwork.id} title={artwork.title} customerEmail={customerEmail} />
        </div>
      </div>
    ),
  }));

  const selected = artworks.find(({ displayId }) => displayId === selectedId)?.artwork ?? null;
  return (
    <>
      <LayoutGrid cards={cards} className="card-grid card-grid--masonry" onCardSelect={(card) => setSelectedId(String(card.id))} />
      <SharedArtworkModal artwork={selected} onClose={() => setSelectedId(null)} customerEmail={customerEmail} />
      <div ref={sentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" />
      {loading ? <p className="centered-copy" role="status">Loading more originals…</p> : null}
      {loadError ? <p className="centered-copy" role="alert">{loadError}</p> : null}
    </>
  );
}
