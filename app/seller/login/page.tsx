import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerLoginForm } from "@/components/seller-login-form";

export default function SellerLoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Seller Sign In</PageTitle>
        <SellerLoginForm />
      </main>
    </>
  );
}
