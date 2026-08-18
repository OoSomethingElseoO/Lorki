import { ArtworkCard } from "@/components/artwork-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { prints } from "@/data/site-data";

export default function PrintsPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Prints</PageTitle>
        <section className="card-grid" aria-label="Artwork prints">
          {prints.map((print) => (
            <ArtworkCard artwork={print} variant="buy" key={print.id} />
          ))}
        </section>
      </main>
    </>
  );
}
