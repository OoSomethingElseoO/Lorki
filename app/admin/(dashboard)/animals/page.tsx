import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { AnimalForm } from "@/components/admin/animal-form";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminAnimalsPage() {
  const [animals, conservancies] = await Promise.all([
    prisma.animal.findMany({ include: { conservancy: true }, orderBy: { createdAt: "desc" } }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Animals</h1>
      <AnimalForm conservancies={conservancies} />

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
                <Link href={`/admin/animals/${animal.id}/edit`}>Edit</Link>{" "}
                <DeleteButton endpoint={`/api/admin/animals/${animal.id}`} confirmLabel={animal.name} />
              </td>
            </tr>
          ))}
          {animals.length === 0 ? (
            <tr>
              <td colSpan={5}>No animals yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
