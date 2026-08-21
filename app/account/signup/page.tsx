import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { AccountSignupForm } from "@/components/account-signup-form";

export default function SignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Create an Account</PageTitle>
        <AccountSignupForm />
      </main>
    </>
  );
}
