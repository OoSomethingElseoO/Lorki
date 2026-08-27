import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { ResetPasswordForm } from "@/components/reset-password-form";

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
        <ResetPasswordForm token={token} />
      </main>
      <Footer />
    </>
  );
}
