import { prisma } from "@/lib/prisma";
import { InquiryStatusForm } from "@/components/admin/inquiry-status-form";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { InquiriesBulkForm } from "@/components/admin/inquiries-bulk-form";
import { Pagination } from "@/components/pagination";
import { getCampaignLabel } from "@/lib/campaigns";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminInquiriesPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
          { artwork: { title: { contains: query, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [inquiries, totalCount] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      include: {
        artwork: { include: { campaign: { include: { animal: true, conservancy: true, artist: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.inquiry.count({ where }),
  ]);

  return (
    <>
      <h1>Inquiries</h1>
      <p className="admin-form__hint">
        Interest in one-of-one originals — these go through a personal sale, not instant checkout. Follow up by
        email, then record the finished sale from /admin/orders.
      </p>

      <AdminSearchForm placeholder="Search by buyer name, email, or artwork" defaultValue={query} />

      <InquiriesBulkForm>
        <table className="admin-table">
          <thead>
            <tr>
              <th></th>
              <th>Artwork</th>
              <th>Buyer</th>
              <th>Message</th>
              <th>Status</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr key={inquiry.id}>
                <td>
                  <input type="checkbox" name="inquiryIds" value={inquiry.id} aria-label={`Select inquiry from ${inquiry.name}`} />
                </td>
                <td>
                  {inquiry.artwork.title}
                  <br />
                  <span className="admin-form__hint">
                    {getCampaignLabel(inquiry.artwork.campaign)}
                  </span>
                </td>
                <td>
                  {inquiry.name}
                  <br />
                  <span className="admin-form__hint">{inquiry.email}</span>
                </td>
                <td>{inquiry.message ?? "—"}</td>
                <td>
                  <InquiryStatusForm inquiryId={inquiry.id} status={inquiry.status} />
                </td>
                <td>{inquiry.createdAt.toLocaleDateString()}</td>
              </tr>
            ))}
            {inquiries.length === 0 ? (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    message={query ? `No inquiries match "${query}".` : "No inquiries yet."}
                    hint={query ? "Try a different search term." : "Inquiries show up here when a buyer asks about an original."}
                  />
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </InquiriesBulkForm>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/inquiries"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
