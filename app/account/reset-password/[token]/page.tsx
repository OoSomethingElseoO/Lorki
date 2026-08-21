import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { AccountResetPasswordForm } from "@/components/account-reset-password-form";

type ResetPasswordPageProps = {
  params: Promise<{ token: string }>;
};

export default async function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const { token } = await params;

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Choose a New Password</PageTitle>
        <AccountResetPasswordForm token={token} />
      </main>
    </>
  );
}
