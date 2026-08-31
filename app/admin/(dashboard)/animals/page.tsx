import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AnimalForm } from "@/components/admin/animal-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { EditIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminAnimalsPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { species: { contains: query, mode: "insensitive" as const } },
          { region: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [animals, totalCount, conservancies] = await Promise.all([
    prisma.animal.findMany({
      where,
      include: { conservancy: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.animal.count({ where }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Animals</h1>
      <Tabs defaultValue="animals">
        <TabsList aria-label="Animal sections">
          <TabsTrigger value="animals">Animals</TabsTrigger>
          <TabsTrigger value="add">Add animal</TabsTrigger>
        </TabsList>

        <TabsContent value="animals">
          <AdminSearchForm placeholder="Search by name, species, or region" defaultValue={query} />

          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Species</th>
                <th>Region</th>
                <th>Conservancy</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {animals.map((animal) => (
                <tr key={animal.id}>
                  <td>{animal.name}</td>
                  <td>{animal.species}</td>
                  <td>{animal.region}</td>
                  <td>{animal.conservancy.name}</td>
                  <td>
                    <Link href={`/admin/animals/${animal.id}/edit`}>
                      <EditIcon />
                      Edit
                    </Link>{" "}
                    <DeleteButton endpoint={`/api/admin/animals/${animal.id}`} confirmLabel={animal.name} />
                  </td>
                </tr>
              ))}
              {animals.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      message={query ? `No animals match "${query}".` : "No animals yet."}
                      hint={query ? "Try a different search term." : "Use the Add animal tab to add your first animal."}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <Pagination
            page={currentPage}
            totalPages={adminTotalPages(totalCount)}
            basePath="/admin/animals"
            extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
          />
        </TabsContent>

        <TabsContent value="add">
          <AnimalForm conservancies={conservancies} />
        </TabsContent>
      </Tabs>
    </>
  );
}
