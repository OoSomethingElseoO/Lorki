import { prisma } from "@/lib/prisma";
import { CoOpForm } from "@/components/admin/co-op-form";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function AdminCoOpsPage() {
  const coOps = await prisma.coOp.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <h1>Co-ops</h1>
      <CoOpForm />

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
                <DeleteButton endpoint={`/api/admin/co-ops/${coOp.id}`} confirmLabel={coOp.name} />
              </td>
            </tr>
          ))}
          {coOps.length === 0 ? (
            <tr>
              <td colSpan={4}>No co-ops yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
