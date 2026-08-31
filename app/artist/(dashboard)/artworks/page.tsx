import Link from "next/link";
import { redirect } from "next/navigation";
import { ArtistArtworkRow } from "@/components/artist-artwork-row";
import { buttonVariants } from "@/components/ui/button";
import { CardHeader } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

export default async function ArtistArtworksPage() {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) {
    redirect("/login");
  }

  const artworks = await prisma.artwork.findMany({
    where: { campaign: { artistId: artist.id } },
    include: { campaign: { include: { animal: true, conservancy: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <CardHeader>
        <h1 style={{ margin: 0 }}>Your Listings</h1>
        <Link href="/artist/artworks/new" className={buttonVariants()}>
          List a new piece
        </Link>
      </CardHeader>

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
            <ArtistArtworkRow key={artwork.id} artwork={artwork} causeName={getCampaignCauseName(artwork.campaign)} />
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
