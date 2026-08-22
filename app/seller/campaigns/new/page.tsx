import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerNewCampaignForm } from "@/components/seller-new-campaign-form";
import { getCurrentSeller } from "@/lib/seller-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SellerNewCampaignPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    redirect("/seller/login");
  }

  const animals = await prisma.animal.findMany({
    include: { conservancy: true },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Start a Campaign</PageTitle>
        <SellerNewCampaignForm
          animals={animals.map((animal) => ({
            id: animal.id,
            name: animal.name,
            species: animal.species,
            conservancyName: animal.conservancy.name,
          }))}
        />
      </main>
    </>
  );
}
