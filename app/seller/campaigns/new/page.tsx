import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerNewCampaignForm } from "@/components/seller-new-campaign-form";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SellerNewCampaignPage() {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    redirect("/login");
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
