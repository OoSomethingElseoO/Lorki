import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { SignupForm } from "@/components/signup-form";

type SignupPageProps = {
  // ?role=artist / ?role=cause pre-selects the intent picker below — lets
  // a future entry point ("Sell Your Art", "Register a Cause") link
  // straight in with the right choice already made, skipping a click.
  // Anything else (including no param at all) leaves it unselected.
  searchParams: Promise<{ role?: string }>;
};

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const { role } = await searchParams;
  const initialRole = role === "artist" || role === "cause" ? role : null;

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Create an Account</PageTitle>
        <div className="auth-layout">
          <div className="auth-layout__panel">
            <img
              src="/artwork/featured-original.png"
              alt=""
              className="auth-layout__panel-image"
            />
            <div className="auth-layout__panel-copy">
              <p className="auth-layout__panel-quote">Where original wildlife art meets conservation.</p>
              <p className="auth-layout__panel-caption">
                Every piece sold funds the artist who made it and the conservancy protecting the animal it depicts.
              </p>
            </div>
          </div>
          <div className="auth-layout__form">
            <SignupForm initialRole={initialRole} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
