import type { StorefrontArtwork } from "@/lib/storefront";
import { BuyButton } from "@/components/buy-button";

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
        <BuyButton
          artworkId={artwork.id}
          title={artwork.title}
          priceCents={artwork.priceCents}
          customerEmail={customerEmail}
        />
      </div>
    </article>
  );
}
