import Link from "next/link";
import { FallbackImage } from "@/components/ui/fallback-image";

type ArtistCardProps = {
  artist: {
    slug: string;
    name: string;
    country: string;
    imageUrl: string;
  };
};

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <article className="artist-card">
      <Link href={`/artists/${artist.slug}`} aria-label={`View ${artist.name}'s artist page`}>
        <FallbackImage
          src={artist.imageUrl}
          alt={`Portrait placeholder for artist ${artist.name}.`}
          className="artist-card__image"
        />
        <div className="artist-card__body">
          <h2>{artist.name}</h2>
          <p>
            <span className="detail-label">Country:</span> {artist.country}
          </p>
        </div>
      </Link>
    </article>
  );
}
