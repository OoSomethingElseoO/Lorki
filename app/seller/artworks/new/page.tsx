import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerNewArtworkForm } from "@/components/seller-new-artwork-form";
import { getCurrentSeller } from "@/lib/seller-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ campaignId?: string }>;
};

export default async function SellerNewArtworkPage({ searchParams }: PageProps) {
  const seller = await getCurrentSeller();
  if (!seller) {
    redirect("/seller/login");
  }

  const { campaignId } = await searchParams;

  const campaigns = await prisma.campaign.findMany({
    where: { artistId: seller.id },
    include: { animal: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>List a Piece</PageTitle>
        <SellerNewArtworkForm
          campaigns={campaigns.map((campaign) => ({ id: campaign.id, label: campaign.animal.name }))}
          defaultCampaignId={campaignId}
        />
      </main>
    </>
  );
}
