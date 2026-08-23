// Shared by every /admin/* list page — same page size and page-number
// parsing lib/storefront.ts already uses for the public storefront, so
// admin tables paginate the same way rather than inventing a second
// convention.
export const ADMIN_PAGE_SIZE = 20;

export function normalizeAdminPage(page: string | undefined): number {
  const parsed = Number(page);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function adminTotalPages(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / ADMIN_PAGE_SIZE));
}
