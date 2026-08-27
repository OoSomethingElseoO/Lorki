import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { SignupForm } from "@/components/signup-form";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Create an Account</PageTitle>
        <SignupForm />
      </main>
      <Footer />
    </>
  );
}
