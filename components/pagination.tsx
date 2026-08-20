import Link from "next/link";

type PaginationProps = {
  page: number;
  totalPages: number;
  basePath: string;
};

export function Pagination({ page, totalPages, basePath }: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="pagination" aria-label="Pagination">
      {page > 1 ? (
        <Link href={page - 1 === 1 ? basePath : `${basePath}?page=${page - 1}`} className="button-link">
          Previous
        </Link>
      ) : (
        <span className="button-link button-link--disabled" aria-disabled="true">
          Previous
        </span>
      )}
      <span className="pagination__status">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link href={`${basePath}?page=${page + 1}`} className="button-link">
          Next
        </Link>
      ) : (
        <span className="button-link button-link--disabled" aria-disabled="true">
          Next
        </span>
      )}
    </nav>
  );
}
