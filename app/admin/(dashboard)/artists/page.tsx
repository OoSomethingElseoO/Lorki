import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ArtistForm } from "@/components/admin/artist-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { EditIcon } from "@/components/admin/icons";
import { Pagination } from "@/components/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminArtistsPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { country: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [artists, totalCount, coOps] = await Promise.all([
    prisma.artist.findMany({
      where,
      include: { socialLinks: true, coOp: true },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.artist.count({ where }),
    prisma.coOp.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Artists</h1>
      <Tabs defaultValue="artists">
        <TabsList aria-label="Artist sections">
          <TabsTrigger value="artists">Artists</TabsTrigger>
          <TabsTrigger value="add">Add artist</TabsTrigger>
        </TabsList>

        <TabsContent value="artists">
          <AdminSearchForm placeholder="Search by name or country" defaultValue={query} />

          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Country</th>
                <th>Co-op</th>
                <th>Social links</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {artists.map((artist) => (
                <tr key={artist.id}>
                  <td>{artist.name}</td>
                  <td>{artist.country}</td>
                  <td>{artist.coOp?.name ?? "—"}</td>
                  <td>
                    {artist.socialLinks.length === 0
                      ? "—"
                      : artist.socialLinks.map((link) => (
                          <a key={link.id} href={link.url} target="_blank" rel="noreferrer" className="admin-table__link">
                            {link.platform}
                          </a>
                        ))}
                  </td>
                  <td>
                    <Link href={`/admin/artists/${artist.id}/edit`}>
                      <EditIcon />
                      Edit
                    </Link>{" "}
                    <DeleteButton endpoint={`/api/admin/artists/${artist.id}`} confirmLabel={artist.name} />
                  </td>
                </tr>
              ))}
              {artists.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState
                      message={query ? `No artists match "${query}".` : "No artists yet."}
                      hint={query ? "Try a different search term." : "Use the Add artist tab to add your first artist."}
                    />
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <Pagination
            page={currentPage}
            totalPages={adminTotalPages(totalCount)}
            basePath="/admin/artists"
            extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
          />
        </TabsContent>

        <TabsContent value="add">
          <ArtistForm coOps={coOps} />
        </TabsContent>
      </Tabs>
    </>
  );
}
