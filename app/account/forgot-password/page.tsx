import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { AccountForgotPasswordForm } from "@/components/account-forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Reset Your Password</PageTitle>
        <AccountForgotPasswordForm />
      </main>
    </>
  );
}
