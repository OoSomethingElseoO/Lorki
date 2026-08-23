import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
  // Any other query params to carry across page links — e.g. "q=lion"
  // from an admin search box, so paging forward doesn't drop the search.
  extraQuery?: string;
};

function pageHref(basePath: string, page: number, extraQuery?: string) {
  const params = new URLSearchParams(extraQuery);
  if (page > 1) {
    params.set("page", String(page));
  }
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({ page, totalPages, basePath, extraQuery }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={pageHref(basePath, page - 1, extraQuery)} className={buttonVariants()}>
          Previous
        </Link>
      ) : (
        <span className={cn(buttonVariants(), "opacity-40 cursor-not-allowed")} aria-disabled="true">
          Previous
        </span>
      )}
      <span className="pagination__status">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={pageHref(basePath, page + 1, extraQuery)} className={buttonVariants()}>
          Next
        </Link>
      ) : (
        <span className={cn(buttonVariants(), "opacity-40 cursor-not-allowed")} aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
