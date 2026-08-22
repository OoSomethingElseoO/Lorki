import type { StorefrontArtwork } from "@/lib/storefront";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";

type ArtworkCardProps = {
  artwork: StorefrontArtwork;
  customerEmail?: string;
};

export function ArtworkCard({ artwork, customerEmail }: ArtworkCardProps) {
  return (
    <article className="artwork-card">
      <img src={artwork.imageUrl} alt={artwork.altText} className="artwork-card__image" />
      <div className="artwork-card__body">
        <h2>{artwork.title}</h2>
        <p>{artwork.artistName}</p>
        {artwork.kind === "ORIGINAL" ? (
          <InquiryForm artworkId={artwork.id} title={artwork.title} customerEmail={customerEmail} />
        ) : (
          <BuyButton
            artworkId={artwork.id}
            title={artwork.title}
            priceCents={artwork.priceCents}
            customerEmail={customerEmail}
          />
        )}
      </div>
    </article>
  );
}
