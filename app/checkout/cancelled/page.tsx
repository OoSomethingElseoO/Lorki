import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";

export default function CheckoutCancelledPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Checkout cancelled</PageTitle>
        <div className="contact-card">
          <p>No charge was made. The piece is still available if you'd like to try again.</p>
          <Link href="/originals" className="button-link">
            Back to originals
          </Link>
        </div>
      </main>
    </>
  );
}
