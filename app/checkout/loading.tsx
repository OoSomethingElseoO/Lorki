import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";

export default function CheckoutLoading() {
  return (
    <>
      <SiteHeader />
      <main className="page-main checkout-page checkout-page--loading" id="main-content" aria-busy="true">
        <Skeleton className="skeleton-line skeleton-line--eyebrow" />
        <Skeleton className="skeleton-line skeleton-line--heading" />
        <div className="checkout-page__loading-card">
          <Skeleton className="checkout-page__loading-image" />
          <div>
            <Skeleton className="skeleton-line skeleton-line--heading" />
            <Skeleton className="skeleton-line skeleton-line--meta" />
            <Skeleton className="skeleton-line skeleton-line--price" />
            <Skeleton className="skeleton-button" />
          </div>
        </div>
        <span className="sr-only">Loading checkout…</span>
      </main>
    </>
  );
}
