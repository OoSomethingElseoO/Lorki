import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerProfileForm } from "@/components/seller-profile-form";
import { getCurrentSeller } from "@/lib/seller-auth";

export const dynamic = "force-dynamic";

export default async function SellerProfilePage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    redirect("/seller/login");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Your Profile</PageTitle>
        <SellerProfileForm
          initial={{ name: seller.name, country: seller.country, bio: seller.bio, imageUrl: seller.imageUrl }}
        />
      </main>
    </>
  );
}
