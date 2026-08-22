import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Sign In</PageTitle>
        <LoginForm />
      </main>
    </>
  );
}
