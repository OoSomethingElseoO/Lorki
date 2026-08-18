import type { Artwork } from "@/data/site-data";
import { inquiryHref } from "@/data/site-data";

type ArtworkCardProps = {
  artwork: Artwork;
  variant?: "inquiry" | "buy";
};

export function ArtworkCard({ artwork, variant = "inquiry" }: ArtworkCardProps) {
  const actionLabel =
    variant === "buy"
      ? `Buy ${artwork.title} directly`
      : `Email inquiry about ${artwork.title}`;

  return (
    <article className="artwork-card">
      <img src={artwork.image} alt={artwork.alt} className="artwork-card__image" />
      <div className="artwork-card__body">
        <h2>{artwork.title}</h2>
        <p>{artwork.artistName}</p>
        <p className="price">{artwork.price}</p>
        <a className="button-link" href={inquiryHref(artwork.title)} aria-label={actionLabel}>
          {variant === "buy" ? "Direct Buy" : "Email Inquiry"}
        </a>
      </div>
    </article>
  );
}
