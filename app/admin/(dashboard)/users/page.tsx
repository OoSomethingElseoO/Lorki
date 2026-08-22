import { prisma } from "@/lib/prisma";
import { AdminUserForm } from "@/components/admin/admin-user-form";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <>
      <h1>Admin users</h1>
      <p className="admin-form__hint">
        At least one admin must always exist, and you can't delete the account you're currently signed in as.
      </p>
      <AdminUserForm />

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
              <td colSpan={4}>No admins yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
