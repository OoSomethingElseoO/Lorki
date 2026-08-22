import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ConservancyForm } from "@/components/admin/conservancy-form";
import { DeleteButton } from "@/components/admin/delete-button";
import { VerifyConservancyChecklist } from "@/components/admin/verify-conservancy-button";

export const dynamic = "force-dynamic";

export default async function AdminConservanciesPage() {
  const conservancies = await prisma.conservancy.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <h1>Conservancies</h1>
      <ConservancyForm />

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
                    {new Date(conservancy.verifiedAt).toLocaleDateString()}
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
                  Edit
                </Link>{" "}
                <DeleteButton endpoint={`/api/admin/conservancies/${conservancy.id}`} confirmLabel={conservancy.name} />
              </td>
            </tr>
          ))}
          {conservancies.length === 0 ? (
            <tr>
              <td colSpan={7}>No conservancies yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
