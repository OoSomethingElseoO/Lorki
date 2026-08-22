import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaign-form";
import { getCampaignLabel } from "@/lib/campaigns";

type EditCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;

  const [campaign, animals, conservancies, artists] = await Promise.all([
    prisma.campaign.findUnique({ where: { id }, include: { animal: true, conservancy: true, artist: true } }),
    prisma.animal.findMany({ orderBy: { name: "asc" } }),
    prisma.conservancy.findMany({ orderBy: { name: "asc" } }),
    prisma.artist.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <>
      <h1>Edit {getCampaignLabel(campaign)}</h1>
      <CampaignForm
        animals={animals}
        conservancies={conservancies}
        artists={artists}
        id={campaign.id}
        initial={{
          animalId: campaign.animalId,
          conservancyId: campaign.conservancyId,
          artistId: campaign.artistId,
          artistPercent: campaign.artistPercent,
          conservancyPercent: campaign.conservancyPercent,
          operationsPercent: campaign.operationsPercent,
        }}
      />
    </>
  );
}
