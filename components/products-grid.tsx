"use client";

import { useEffect, useRef, useState } from "react";
import { ArtworkCard } from "@/components/artwork-card";
import { ArtworkSkeletonGrid } from "@/components/artwork-skeleton-grid";
import type { ProductFilters, StorefrontArtwork } from "@/lib/storefront";

export function ProductsGrid({ initialItems, initialPage, totalPages, customerEmail, filters }: { initialItems: StorefrontArtwork[]; initialPage: number; totalPages: number; customerEmail?: string; filters: ProductFilters }) {
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialPage < totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || loadingRef.current || !hasMore) return;
      loadingRef.current = true; setLoading(true); setError(null);
      const query = new URLSearchParams({ page: String(page + 1), kind: filters.kind ?? "ALL", sort: filters.sort ?? "newest", ...(filters.artist ? { artist: filters.artist } : {}), ...(filters.dateFrom ? { dateFrom: filters.dateFrom } : {}), ...(filters.dateTo ? { dateTo: filters.dateTo } : {}), ...(filters.minPriceCents !== undefined ? { minPrice: String(filters.minPriceCents / 100) } : {}), ...(filters.maxPriceCents !== undefined ? { maxPrice: String(filters.maxPriceCents / 100) } : {}) });
      fetch(`/api/products?${query.toString()}`, { cache: "force-cache" })
        .then(async (response) => { if (!response.ok) throw new Error("Products could not be loaded"); return response.json() as Promise<{ items: StorefrontArtwork[]; page: number; totalPages: number }>; })
        .then((next) => { setItems((current) => [...current, ...next.items]); setPage(next.page); setHasMore(next.page < next.totalPages); })
        .catch(() => setError("More products could not be loaded. Try again."))
        .finally(() => { loadingRef.current = false; setLoading(false); });
    }, { rootMargin: "600px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [filters, hasMore, page]);

  return <>
    <div className="card-grid">{items.map((artwork, index) => <ArtworkCard key={`${artwork.id}-${index}`} artwork={artwork} customerEmail={customerEmail} />)}</div>
    {hasMore ? <div ref={sentinel} className="infinite-scroll-sentinel" aria-hidden="true" /> : null}
    {loading ? <ArtworkSkeletonGrid count={4} /> : null}
    {error ? <p className="centered-copy" role="alert">{error}</p> : null}
  </>;
}
