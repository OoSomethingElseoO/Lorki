import Link from "next/link";
import { notFound } from "next/navigation";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { getLiveArtworkById } from "@/lib/storefront";

type CheckoutPageProps = { searchParams: Promise<{ artworkId?: string }> };

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const { artworkId } = await searchParams;
  if (!artworkId) notFound();
  const [artwork, customer] = await Promise.all([getLiveArtworkById(artworkId), getCurrentUser()]);
  if (!artwork) notFound();

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>{artwork.kind === "ORIGINAL" ? "Purchase request" : "Checkout"}</PageTitle>
        <section className="checkout-page" aria-labelledby="checkout-artwork-title">
          <img src={artwork.imageUrl} alt={artwork.altText} className="checkout-page__image" />
          <div className="checkout-page__details">
            <p className="detail-label">Original artwork</p>
            <h1 id="checkout-artwork-title">{artwork.title}</h1>
            <p className="text-muted">{artwork.artistName} · {artwork.artistCountry}</p>
            <p className="checkout-page__price">${(artwork.priceCents / 100).toFixed(2)}</p>
            {artwork.kind === "ORIGINAL" ? (
              <InquiryForm artworkId={artwork.id} title={artwork.title} customerEmail={customer?.email} />
            ) : (
              <BuyButton artworkId={artwork.id} title={artwork.title} priceCents={artwork.priceCents} customerEmail={customer?.email} />
            )}
            <Link href="/originals" className={buttonVariants({ variant: "outline" })}>Continue shopping</Link>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
