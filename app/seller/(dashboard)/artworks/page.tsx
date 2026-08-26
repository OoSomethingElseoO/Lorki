import Link from "next/link";
import { redirect } from "next/navigation";
import { SellerArtworkRow } from "@/components/seller-artwork-row";
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
            <SellerArtworkRow key={artwork.id} artwork={artwork} causeName={getCampaignCauseName(artwork.campaign)} />
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
