import { redirect } from "next/navigation";
import { ArtistNewArtworkForm } from "@/components/artist-new-artwork-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ campaignId?: string }>;
};

export default async function ArtistNewArtworkPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) {
    redirect("/login");
  }

  const { campaignId } = await searchParams;

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: artist.id },
    include: { animal: true, conservancy: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>List a Piece</h1>
      <ArtistNewArtworkForm
        campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: getCampaignCauseName(campaign) }))}
        defaultCampaignId={campaignId}
      />
    </>
  );
}
