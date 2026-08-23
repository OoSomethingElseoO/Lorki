import { redirect } from "next/navigation";
import { SellerNewArtworkForm } from "@/components/seller-new-artwork-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCampaignCauseName } from "@/lib/campaigns";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ campaignId?: string }>;
};

export default async function SellerNewArtworkPage({ searchParams }: PageProps) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
  }

  const { campaignId } = await searchParams;

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: seller.id },
    include: { animal: true, conservancy: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <h1>List a Piece</h1>
      <SellerNewArtworkForm
        campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: getCampaignCauseName(campaign) }))}
        defaultCampaignId={campaignId}
      />
    </>
  );
}
