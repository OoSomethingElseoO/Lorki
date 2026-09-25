import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { ArtworkSkeletonGrid } from "@/components/artwork-skeleton-grid";

export default function OriginalsLoading() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content" aria-busy="true">
        <PageTitle>Originals</PageTitle>
        <ArtworkSkeletonGrid count={12} />
      </main>
    </>
  );
}
