import Link from "next/link";
import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { DeleteButton } from "@/components/admin/delete-button";
import { getCurrentSeller } from "@/lib/seller-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SellerArtworksPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    redirect("/seller/login");
  }

  const artworks = await prisma.artwork.findMany({
    where: { campaign: { artistId: seller.id } },
    include: { campaign: { include: { animal: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Your Listings</PageTitle>
        <p className="centered-copy">
          <Link href="/seller/artworks/new" className="button-link">
            List a new piece
          </Link>
        </p>

        <table className="admin-table" style={{ maxWidth: "78rem", margin: "0 auto" }}>
          <thead>
            <tr>
              <th>Title</th>
              <th>Animal</th>
              <th>Kind</th>
              <th>Price</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {artworks.map((artwork) => (
              <tr key={artwork.id}>
                <td>{artwork.title}</td>
                <td>{artwork.campaign.animal.name}</td>
                <td>{artwork.kind}</td>
                <td>${(artwork.priceCents / 100).toFixed(2)}</td>
                <td>{artwork.inventoryState}</td>
                <td>
                  {artwork.inventoryState === "SOLD" ? (
                    "—"
                  ) : (
                    <DeleteButton endpoint={`/api/seller/artworks/${artwork.id}`} confirmLabel={artwork.title} />
                  )}
                </td>
              </tr>
            ))}
            {artworks.length === 0 ? (
              <tr>
                <td colSpan={6}>No listings yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </main>
    </>
  );
}
