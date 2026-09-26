"use client";

import { useEffect, useRef, useState } from "react";
import { ArtworkCard } from "@/components/artwork-card";
import { ArtworkSkeletonGrid } from "@/components/artwork-skeleton-grid";
import type { ProductFilters, StorefrontArtwork } from "@/lib/storefront";

type Props = { initialItems: StorefrontArtwork[]; initialPage: number; totalPages: number; filters: ProductFilters };

export function CatalogueExplorer({ initialItems, initialPage, totalPages, filters: initialFilters }: Props) {
  const [filters, setFilters] = useState({ q: initialFilters.q ?? "", kind: initialFilters.kind ?? "ALL", artist: initialFilters.artist ?? "", dateFrom: initialFilters.dateFrom ?? "", dateTo: initialFilters.dateTo ?? "", minPrice: initialFilters.minPriceCents ? String(initialFilters.minPriceCents / 100) : "", maxPrice: initialFilters.maxPriceCents ? String(initialFilters.maxPriceCents / 100) : "", sort: initialFilters.sort ?? "newest" });
  const [items, setItems] = useState(initialItems);
  const [page, setPage] = useState(initialPage);
  const [pages, setPages] = useState(totalPages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const query = (nextPage: number) => new URLSearchParams({ page: String(nextPage), q: filters.q, kind: filters.kind, artist: filters.artist, dateFrom: filters.dateFrom, dateTo: filters.dateTo, minPrice: filters.minPrice, maxPrice: filters.maxPrice, sort: filters.sort });
  const updateUrl = () => { const params = query(1); params.delete("page"); window.history.replaceState(null, "", `/products?${params.toString()}`); };

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController(); controllerRef.current = controller;
      const generation = ++generationRef.current;
      setLoading(true); setError(null); updateUrl();
      try {
        const response = await fetch(`/api/products?${query(1)}`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Catalogue unavailable");
        const result = await response.json() as { items: StorefrontArtwork[]; page: number; totalPages: number };
        if (generation !== generationRef.current) return;
        setItems(result.items); setPage(result.page); setPages(result.totalPages);
      } catch (err) { if ((err as Error).name !== "AbortError") setError("Products could not be loaded."); }
      finally { if (generation === generationRef.current) setLoading(false); }
    }, 280);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.q, filters.kind, filters.artist, filters.dateFrom, filters.dateTo, filters.minPrice, filters.maxPrice, filters.sort]);

  useEffect(() => {
    const node = sentinel.current; if (!node) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading || loadingMoreRef.current || page >= pages) return;
      loadingMoreRef.current = true;
      try {
        const response = await fetch(`/api/products?${query(page + 1)}`, { cache: "force-cache" });
        if (!response.ok) throw new Error("Catalogue unavailable");
        const next = await response.json() as { items: StorefrontArtwork[]; page: number; totalPages: number };
        setItems((current) => [...current, ...next.items.filter((item) => !current.some((existing) => existing.id === item.id))]); setPage(next.page); setPages(next.totalPages);
      } catch { setError("More products could not be loaded. Try again."); }
      finally { loadingMoreRef.current = false; }
    }, { rootMargin: "600px" });
    observer.observe(node); return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pages, loading, filters]);

  const set = (key: keyof typeof filters, value: string) => setFilters((current) => ({ ...current, [key]: value }));
  return <>
    <form className="products-filters" role="search" onSubmit={(event) => event.preventDefault()}>
      <input name="q" type="search" value={filters.q} onChange={(event) => set("q", event.target.value)} placeholder="Search artwork or artists" aria-label="Search artwork or artists" />
      <select value={filters.kind} onChange={(event) => set("kind", event.target.value)} aria-label="Artwork type"><option value="ALL">All work</option><option value="ORIGINAL">Originals</option><option value="PRINT">Prints</option></select>
      <input type="search" value={filters.artist} onChange={(event) => set("artist", event.target.value)} placeholder="Artist" aria-label="Artist" />
      <input type="date" value={filters.dateFrom} onChange={(event) => set("dateFrom", event.target.value)} aria-label="From date" />
      <input type="date" value={filters.dateTo} onChange={(event) => set("dateTo", event.target.value)} aria-label="To date" />
      <input type="number" min="0" value={filters.minPrice} onChange={(event) => set("minPrice", event.target.value)} placeholder="Min price" aria-label="Minimum price" />
      <input type="number" min="0" value={filters.maxPrice} onChange={(event) => set("maxPrice", event.target.value)} placeholder="Max price" aria-label="Maximum price" />
      <select value={filters.sort} onChange={(event) => set("sort", event.target.value)} aria-label="Sort"><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select>
    </form>
    {loading ? <ArtworkSkeletonGrid count={4} /> : null}
    <div className="card-grid">{items.map((artwork) => <ArtworkCard key={artwork.id} artwork={artwork} />)}</div>
    {error ? <p className="centered-copy" role="alert">{error}</p> : null}
    {page < pages ? <div ref={sentinel} className="infinite-scroll-sentinel" aria-hidden="true" /> : null}
  </>;
}
