import { redirect } from "next/navigation";
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

  const [animals, conservancies] = await Promise.all([
    prisma.animal.findMany({
      include: { conservancy: true },
      orderBy: { name: "asc" },
    }),
    // Unverified (self-registered, not yet reviewed by an admin) causes
    // aren't offered here at all — /api/seller/campaigns rejects them too,
    // but excluding them from the picker means an artist never hits that
    // error in the first place.
    prisma.conservancy.findMany({ where: { verifiedAt: { not: null } }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <h1>Start a Campaign</h1>
      <SellerNewCampaignForm
        animals={animals.map((animal) => ({
          id: animal.id,
          name: animal.name,
          species: animal.species,
          conservancyName: animal.conservancy.name,
        }))}
        conservancies={conservancies.map((conservancy) => ({ id: conservancy.id, name: conservancy.name }))}
      />
    </>
  );
}
