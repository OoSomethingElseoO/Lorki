import { redirect } from "next/navigation";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { CauseOnboardingForm } from "@/components/cause-onboarding-form";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function CauseOnboardingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/cause/onboarding");
  }
  if (user.conservancy) {
    redirect("/cause/profile");
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Register a Cause</PageTitle>
        <CauseOnboardingForm />
      </main>
    </>
  );
}
