import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerOnboardingForm } from "@/components/seller-onboarding-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SellerOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/seller/onboarding");
  }
  if (user.artist) {
    redirect("/seller");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Start Selling</PageTitle>
        <SellerOnboardingForm />
      </main>
    </>
  );
}
