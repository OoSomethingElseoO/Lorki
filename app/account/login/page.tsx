import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { AccountLoginForm } from "@/components/account-login-form";

export default function AccountLoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Sign In</PageTitle>
        <AccountLoginForm />
      </main>
    </>
  );
}
