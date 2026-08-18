import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { ownerContact } from "@/data/site-data";

export default function ContactUsPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Contact Us</PageTitle>
        <address className="contact-card" aria-label="Contact information">
          <p>{ownerContact.name}</p>
          <p>
            <a href={`mailto:${ownerContact.email}`}>{ownerContact.email}</a>
          </p>
          <p>
            <a href={`tel:${ownerContact.phone.replace(/[^0-9]/g, "")}`}>{ownerContact.phone}</a>
          </p>
        </address>
      </main>
    </>
  );
}
