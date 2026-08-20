import { prisma } from "@/lib/prisma";
import { ArtistForm } from "@/components/admin/artist-form";
import { DeleteButton } from "@/components/admin/delete-button";

export default async function AdminArtistsPage() {
  const [artists, coOps] = await Promise.all([
    prisma.artist.findMany({ include: { socialLinks: true, coOp: true }, orderBy: { createdAt: "desc" } }),
    prisma.coOp.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Artists</h1>
      <ArtistForm coOps={coOps} />

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
                <DeleteButton endpoint={`/api/admin/artists/${artist.id}`} confirmLabel={artist.name} />
              </td>
            </tr>
          ))}
          {artists.length === 0 ? (
            <tr>
              <td colSpan={5}>No artists yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
