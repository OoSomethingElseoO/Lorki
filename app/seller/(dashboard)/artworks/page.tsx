import Link from "next/link";
import { redirect } from "next/navigation";
import { DeleteButton } from "@/components/admin/delete-button";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function SellerArtworksPage() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
  }

  const artworks = await prisma.artwork.findMany({
    where: { campaign: { artistId: seller.id } },
    include: { campaign: { include: { animal: true, conservancy: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <div className="admin-campaign-card__controls" style={{ justifyContent: "space-between", display: "flex", marginBottom: "1rem" }}>
        <h1 style={{ margin: 0 }}>Your Listings</h1>
        <Link href="/seller/artworks/new" className={buttonVariants()}>
          List a new piece
        </Link>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Cause</th>
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
              <td>{getCampaignCauseName(artwork.campaign)}</td>
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
    </>
  );
}
