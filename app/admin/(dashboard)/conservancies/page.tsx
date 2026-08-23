import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConservancyForm } from "@/components/admin/conservancy-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { VerifyConservancyChecklist } from "@/components/admin/verify-conservancy-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { EditIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminConservanciesPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { region: { contains: query, mode: "insensitive" as const } },
          { contactEmail: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [conservancies, totalCount] = await Promise.all([
    prisma.conservancy.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.conservancy.count({ where }),
  ]);

  return (
    <>
      <h1>Conservancies</h1>
      <ConservancyForm />

      <AdminSearchForm placeholder="Search by name, region, or contact email" defaultValue={query} />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Region</th>
            <th>Contact</th>
            <th>Website</th>
            <th>Registered by</th>
            <th>Verified</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {conservancies.map((conservancy) => (
            <tr key={conservancy.id}>
              <td>{conservancy.name}</td>
              <td>{conservancy.region}</td>
              <td>{conservancy.contactEmail}</td>
              <td>
                <a href={conservancy.website} target="_blank" rel="noreferrer">
                  {conservancy.website}
                </a>
              </td>
              <td>{conservancy.userId ? "Self-registered" : "Admin-created"}</td>
              <td>
                {conservancy.verifiedAt ? (
                  <>
                    <span className="status-badge status-badge--positive">
                      Verified {new Date(conservancy.verifiedAt).toLocaleDateString()}
                    </span>
                    {conservancy.registrationVerificationMethod ? (
                      <>
                        <br />
                        <span className="admin-form__hint">{conservancy.registrationVerificationMethod}</span>
                      </>
                    ) : null}
                  </>
                ) : (
                  <VerifyConservancyChecklist
                    conservancyId={conservancy.id}
                    name={conservancy.name}
                    region={conservancy.region}
                    registrationNumber={conservancy.registrationNumber}
                    registrationDocumentUrl={conservancy.registrationDocumentUrl}
                    payoutAccountHolderName={conservancy.payoutAccountHolderName}
                  />
                )}
              </td>
              <td>
                <Link href={`/admin/conservancies/${conservancy.id}/edit`} className="admin-table__link">
                  <EditIcon />
                  Edit
                </Link>{" "}
                <DeleteButton endpoint={`/api/admin/conservancies/${conservancy.id}`} confirmLabel={conservancy.name} />
              </td>
            </tr>
          ))}
          {conservancies.length === 0 ? (
            <tr>
              <td colSpan={7}>
                <EmptyState
                  message={query ? `No conservancies match "${query}".` : "No conservancies yet."}
                  hint={query ? "Try a different search term." : "Use the form above to add your first conservancy."}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/conservancies"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
