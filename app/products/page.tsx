import Link from "next/link";
import { Search } from "lucide-react";
import { CatalogueExplorer } from "@/components/catalogue-explorer";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { getProductCatalogue, type ProductFilters } from "@/lib/storefront";

export const dynamic = "force-dynamic";

type ProductsPageProps = { searchParams: Promise<{ page?: string; q?: string; kind?: string; artist?: string; dateFrom?: string; dateTo?: string; minPrice?: string; maxPrice?: string; sort?: string }> };

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const requestedPage = Number(params.page);
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const filters: ProductFilters = { q: params.q?.trim() || undefined, kind: params.kind === "ORIGINAL" || params.kind === "PRINT" ? params.kind : "ALL", artist: params.artist?.trim() || undefined, dateFrom: params.dateFrom || undefined, dateTo: params.dateTo || undefined, minPriceCents: params.minPrice && Number.isInteger(Number(params.minPrice)) ? Number(params.minPrice) * 100 : undefined, maxPriceCents: params.maxPrice && Number.isInteger(Number(params.maxPrice)) ? Number(params.maxPrice) * 100 : undefined, sort: params.sort === "oldest" || params.sort === "price_asc" || params.sort === "price_desc" ? params.sort : "newest" };
  const result = await getProductCatalogue(page, filters);
  const { items: artworks, totalPages } = result;
  return <>
    <SiteHeader />
    <main className="page-main" id="main-content">
      <div className="products-heading">
        <div><p className="eyebrow">The collection</p><PageTitle>Products</PageTitle></div>
        <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/search" aria-label="Search artwork and artists" title="Search artwork and artists"><Search className="size-5" aria-hidden="true" /></Link>
      </div>
      <p className="admin-form__hint">Original work and prints from every participating artist.</p>
      <CatalogueExplorer initialItems={artworks} initialPage={page} totalPages={totalPages} filters={filters} />
    </main>
    <Footer />
  </>;
}
