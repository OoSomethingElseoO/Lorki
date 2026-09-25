import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";

export default function ArtworkLoading() {
  return (
    <>
      <SiteHeader />
      <main className="page-main artwork-page artwork-page--loading" id="main-content" aria-busy="true">
        <Skeleton className="artwork-page__image artwork-page__image--skeleton" />
        <div className="artwork-page__details">
          <Skeleton className="skeleton-line skeleton-line--eyebrow" />
          <Skeleton className="skeleton-line skeleton-line--heading" />
          <Skeleton className="skeleton-line skeleton-line--meta" />
          <Skeleton className="skeleton-line skeleton-line--price" />
          <Skeleton className="skeleton-line skeleton-line--copy" />
          <Skeleton className="skeleton-line skeleton-line--copy skeleton-line--copy-short" />
          <Skeleton className="skeleton-button" />
        </div>
        <span className="sr-only">Loading artwork…</span>
      </main>
    </>
  );
}
