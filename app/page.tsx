import { SiteHeader } from "@/components/site-header";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <section className="hero" aria-labelledby="home-title">
          <h1 className="sr-only" id="home-title">
            Aurelia Originals
          </h1>
          <div className="hero__content">
            <img
              className="hero__artwork"
              src="/artwork/featured-original.png"
              alt="Abstract mixed-media artwork with terracotta, ochre, black, off-white, and teal layered forms."
            />
          </div>
        </section>

        <section className="originals" id="originals" aria-labelledby="originals-title">
          <div className="originals__sticky-bar">
            <p className="site-wordmark" id="originals-title">
              Aurelia Originals
            </p>
          </div>
          <div className="originals__body">
            <h2>Originals</h2>
            <p>
              A quiet first look at the originals collection. More artwork,
              filtering, and purchase details can be added here next.
            </p>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <p>&copy; 2026 Aurelia Originals</p>
      </footer>
    </>
  );
}
