import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CampaignForm } from "@/components/admin/campaign-form";

type EditCampaignPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;

  const [campaign, animals, artists] = await Promise.all([
    prisma.campaign.findUnique({ where: { id }, include: { animal: true, artist: true } }),
    prisma.animal.findMany({ orderBy: { name: "asc" } }),
    prisma.artist.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!campaign) {
    notFound();
  }

  return (
    <>
      <h1>
        Edit {campaign.animal.name} &times; {campaign.artist.name}
      </h1>
      <CampaignForm
        animals={animals}
        artists={artists}
        id={campaign.id}
        initial={{
          animalId: campaign.animalId,
          artistId: campaign.artistId,
          artistPercent: campaign.artistPercent,
          conservancyPercent: campaign.conservancyPercent,
          operationsPercent: campaign.operationsPercent,
        }}
      />
    </>
  );
}
