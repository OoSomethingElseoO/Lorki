"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleUserRound, ShoppingBag } from "lucide-react";
import { LayoutGrid } from "@/components/ui/layout-grid";
import { InquiryForm } from "@/components/inquiry-form";
import { SharedArtworkModal } from "@/components/shared-artwork-modal";
import { ArtworkSkeletonGrid } from "@/components/artwork-skeleton-grid";
import type { StorefrontArtwork } from "@/lib/storefront";

type OriginalsGridProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
  initialPage: number;
  totalPages: number;
  infiniteScrollEnabled?: boolean;
};

type ArtworkInstance = {
  artwork: StorefrontArtwork;
  displayId: string;
};

// Same split as OriginalsShowcase (components/originals-showcase.tsx): the
// grid reports "clicked, here's the index + rect", this component owns the
// selection/originRect state and hands the resolved artwork to one shared
// ArtworkLightbox, wired for Next/Previous across the full `artworks` array.
export function OriginalsGrid({ artworks: initialArtworks, customerEmail, initialPage, totalPages, infiniteScrollEnabled = true }: OriginalsGridProps) {
  const [artworks, setArtworks] = useState<ArtworkInstance[]>(() => initialArtworks.map((artwork) => ({ artwork, displayId: artwork.id })));
  const sourceArtworksRef = useRef(initialArtworks);
  const loopNumberRef = useRef(0);
  const [page, setPage] = useState(initialPage);
  const [hasMoreRemotePages, setHasMoreRemotePages] = useState(initialPage < totalPages);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const lastLocalLoopAtRef = useRef(0);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !infiniteScrollEnabled) return;
    const controller = new AbortController();

    const appendLocalLoop = () => {
      // IntersectionObserver can remain intersecting while React appends a
      // batch. Rate-limit local repeats so a large viewport cannot append the
      // same source batch in a tight loop.
      const now = Date.now();
      if (now - lastLocalLoopAtRef.current < 350 || sourceArtworksRef.current.length === 0) return;
      lastLocalLoopAtRef.current = now;
      loopNumberRef.current += 1;
      const loop = [...sourceArtworksRef.current].sort(() => Math.random() - 0.5);
      setArtworks((current) => [
        ...current,
        ...loop.map((artwork, index) => ({
          artwork,
          displayId: `${artwork.id}::loop-${loopNumberRef.current}-${index}`,
        })),
      ]);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || loadingRef.current) return;
        if (!hasMoreRemotePages) {
          appendLocalLoop();
          return;
        }
        loadingRef.current = true;
        setLoading(true);
        setLoadError(null);
        fetch(`/api/originals?page=${page + 1}`, { cache: "force-cache", signal: controller.signal })
          .then(async (response) => {
            if (!response.ok) throw new Error("Unable to load more originals");
            return response.json() as Promise<{ items: StorefrontArtwork[]; page: number }>;
          })
          .then((next) => {
            if (next.items.length === 0 || next.page >= totalPages) {
              setHasMoreRemotePages(false);
              appendLocalLoop();
            } else {
              setArtworks((current) => [
                ...current,
                ...next.items.map((artwork) => ({ artwork, displayId: artwork.id })),
              ]);
              sourceArtworksRef.current = [...sourceArtworksRef.current, ...next.items];
              setPage(next.page);
            }
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return;
            setLoadError("More originals could not be loaded. Try again.");
          })
          .finally(() => {
            loadingRef.current = false;
            setLoading(false);
          });
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(sentinel);
    return () => {
      controller.abort();
      observer.disconnect();
    };
  }, [hasMoreRemotePages, infiniteScrollEnabled, page, totalPages]);

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
      {infiniteScrollEnabled ? <div ref={sentinelRef} className="infinite-scroll-sentinel" aria-hidden="true" /> : null}
      {infiniteScrollEnabled && loading ? <ArtworkSkeletonGrid count={4} /> : null}
      {loadError ? <p className="centered-copy" role="alert">{loadError}</p> : null}
    </>
  );
}
