import { prisma } from "@/lib/prisma";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { EmptyState } from "@/components/admin/empty-state";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        isAdmin: true,
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : { isAdmin: true };

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where,
      select: { id: true, email: true, name: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <h1>Admin users</h1>
      <p className="admin-form__hint">
        At least one admin must always exist, and you can't delete the account you're currently signed in as.
      </p>
      <AdminUserForm />

      <AdminSearchForm placeholder="Search by name or email" defaultValue={query} />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Created</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.email}</td>
              <td>{user.createdAt.toLocaleDateString()}</td>
              <td>
                <DeleteButton endpoint={`/api/admin/users/${user.id}`} confirmLabel={user.email} />
              </td>
            </tr>
          ))}
          {users.length === 0 ? (
            <tr>
              <td colSpan={4}>
                <EmptyState
                  message={query ? `No admins match "${query}".` : "No admins yet."}
                  hint={query ? "Try a different search term." : "Use the form above to add another admin."}
                />
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/users"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
