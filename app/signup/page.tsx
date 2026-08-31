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
        <SignupForm initialRole={initialRole} />
      </main>
      <Footer />
    </>
  );
}
