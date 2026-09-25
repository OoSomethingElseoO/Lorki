import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { getBranding } from "@/lib/settings";
import FluidOrb from "@/components/ui/fluid-orb";

export const dynamic = "force-dynamic";

export default async function MissionStatementPage() {
  const { missionStatement } = await getBranding();

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Mission Statement</PageTitle>
        <section className="centered-copy" aria-label="Mission statement">
          <p>{missionStatement}</p>
        </section>
        <div className="mission-orb">
          <FluidOrb size={200} color="#a65f00" />
        </div>
      </main>
      <Footer />
    </>
  );
}
