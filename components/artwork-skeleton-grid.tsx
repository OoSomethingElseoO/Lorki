import { Skeleton } from "@/components/ui/skeleton";

const heights = ["artwork-skeleton--tall", "artwork-skeleton--short", "artwork-skeleton--wide", "artwork-skeleton--medium"];

export function ArtworkSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="artwork-skeleton-grid" aria-label="Loading artworks" role="status">
      {Array.from({ length: count }, (_, index) => (
        <article className={`artwork-skeleton ${heights[index % heights.length]}`} key={index}>
          <Skeleton className="artwork-skeleton__image" />
          <div className="artwork-skeleton__body">
            <Skeleton className="artwork-skeleton__title" />
            <Skeleton className="artwork-skeleton__artist" />
            <div className="artwork-skeleton__footer">
              <Skeleton className="artwork-skeleton__price" />
              <Skeleton className="artwork-skeleton__action" />
            </div>
          </div>
        </article>
      ))}
      <span className="sr-only">Loading artworks…</span>
    </div>
  );
}
