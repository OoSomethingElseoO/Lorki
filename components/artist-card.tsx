import Link from "next/link";
import type { Artist } from "@/data/site-data";

type ArtistCardProps = {
  artist: Artist;
};

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <article className="artist-card">
      <Link href={`/artists/${artist.slug}`} aria-label={`View ${artist.name}'s artist page`}>
        <img
          src={artist.image}
          alt={`Portrait placeholder for artist ${artist.name}.`}
          className="artist-card__image"
        />
        <div className="artist-card__body">
          <h2>{artist.name}</h2>
          <p>
            <span className="detail-label">Country:</span> {artist.country}
          </p>
          <p>
            <span className="detail-label">Age:</span> {artist.age}
          </p>
        </div>
      </Link>
    </article>
  );
}
