import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <main className="admin-page-loading" aria-busy="true" role="status">
      <Skeleton className="skeleton-line skeleton-line--heading" />
      <div className="admin-skeleton-toolbar">
        <Skeleton className="skeleton-line" />
        <Skeleton className="skeleton-button" />
      </div>
      <div className="admin-skeleton-table">
        {Array.from({ length: 7 }, (_, row) => (
          <div className="admin-skeleton-row" key={row}>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading admin page…</span>
    </main>
  );
}
