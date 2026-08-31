import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CoOpForm } from "@/components/admin/co-op-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { EditIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminCoOpsPage({ searchParams }: PageProps) {
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

  const [coOps, totalCount] = await Promise.all([
    prisma.coOp.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.coOp.count({ where }),
  ]);

  return (
    <>
      <h1>Co-ops</h1>
      <Tabs defaultValue="co-ops">
        <TabsList aria-label="Co-op sections">
          <TabsTrigger value="co-ops">Co-ops</TabsTrigger>
          <TabsTrigger value="add">Add co-op</TabsTrigger>
        </TabsList>

        <TabsContent value="co-ops">
          <AdminSearchForm placeholder="Search by name, region, or contact email" defaultValue={query} />

          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Region</th>
                <th>Contact</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {coOps.map((coOp) => (
                <tr key={coOp.id}>
                  <td>{coOp.name}</td>
                  <td>{coOp.region}</td>
                  <td>{coOp.contactEmail}</td>
                  <td>
                    <Link href={`/admin/co-ops/${coOp.id}/edit`} className="admin-table__link">
                      <EditIcon />
                      Edit
                    </Link>{" "}
                    <DeleteButton endpoint={`/api/admin/co-ops/${coOp.id}`} confirmLabel={coOp.name} />
                  </td>
                </tr>
              ))}
              {coOps.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      message={query ? `No co-ops match "${query}".` : "No co-ops yet."}
                      hint={query ? "Try a different search term." : "Use the Add co-op tab to add your first co-op."}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <Pagination
            page={currentPage}
            totalPages={adminTotalPages(totalCount)}
            basePath="/admin/co-ops"
            extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
          />
        </TabsContent>

        <TabsContent value="add">
          <CoOpForm />
        </TabsContent>
      </Tabs>
    </>
  );
}
