import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";

export default function MissionStatementPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Mission Statement</PageTitle>
        <section className="centered-copy" aria-label="Mission statement">
          <p>
            We believe original artwork should feel personal, considered, and accessible. This space is
            designed to connect collectors with artists through clear information, thoughtful presentation,
            and a calm browsing experience that respects every visitor.
          </p>
        </section>
      </main>
    </>
  );
}
