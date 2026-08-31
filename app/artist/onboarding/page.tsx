import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { ArtistOnboardingForm } from "@/components/artist-onboarding-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ArtistOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/artist/onboarding");
  }
  if (user.artist) {
    redirect("/artist");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Start Selling</PageTitle>
        <ArtistOnboardingForm />
      </main>
      <Footer />
    </>
  );
}
