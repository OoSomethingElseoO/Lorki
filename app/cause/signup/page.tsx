import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { SignupForm } from "@/components/signup-form";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

/**
 * A dedicated cause entry point keeps conservation-specific intent and copy
 * separate from ordinary customer signup. Account creation is still the same
 * single User record; after it succeeds the user completes the cause profile.
 */
export default async function CauseSignupPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.conservancy ? "/cause/profile" : "/cause/onboarding");

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Register a Conservation Cause</PageTitle>
        <div className="auth-layout">
          <div className="auth-layout__panel">
            <img
              src="/artwork/featured-original.png"
              alt=""
              className="auth-layout__panel-image"
            />
            <div className="auth-layout__panel-copy">
              <p className="auth-layout__panel-quote">Put your conservation work in front of artists and collectors.</p>
              <p className="auth-layout__panel-caption">
                Create your account first, then submit your organization details for review.
              </p>
            </div>
          </div>
          <div className="auth-layout__form">
            <SignupForm redirectTo="/cause/onboarding" />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
