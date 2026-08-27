import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getBranding } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function ContactUsPage() {
  const { contactName, contactEmail, contactPhone } = await getBranding();

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Contact Us</PageTitle>
        <address className="contact-card" aria-label="Contact information">
          <p>{contactName}</p>
          <p>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p>
            <a href={`tel:${contactPhone.replace(/[^0-9]/g, "")}`}>{contactPhone}</a>
          </p>
        </address>
      </main>
      <Footer />
    </>
  );
}
