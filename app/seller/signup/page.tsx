import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { SellerSignupForm } from "@/components/seller-signup-form";

export default function SellerSignupPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Start Selling</PageTitle>
        <SellerSignupForm />
      </main>
    </>
  );
}
