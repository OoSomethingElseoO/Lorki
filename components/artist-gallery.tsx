"use client";

import { useState } from "react";
import type { Artwork } from "@/data/site-data";
import { inquiryHref } from "@/data/site-data";
import { AccessibleModal } from "@/components/accessible-modal";

type ArtistGalleryProps = {
  artworks: Artwork[];
};

export function ArtistGallery({ artworks }: ArtistGalleryProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<Artwork | null>(null);

  return (
    <>
      <section className="artist-gallery-section" aria-labelledby="artist-gallery-title">
        <h2 id="artist-gallery-title">Available Artwork</h2>
        <div className="gallery-scroll" aria-label="Scrollable artwork gallery">
          {artworks.map((artwork) => (
            <article className="gallery-card" key={artwork.id}>
              <button
                type="button"
                className="gallery-card__image-button"
                aria-label={`Enlarge ${artwork.title}`}
                onClick={() => setSelectedArtwork(artwork)}
              >
                <img src={artwork.image} alt={artwork.alt} />
              </button>
              <h3>{artwork.title}</h3>
              <p className="price">{artwork.price}</p>
              <a href={inquiryHref(artwork.title)} aria-label={`Email inquiry about ${artwork.title}`}>
                Email purchase inquiry
              </a>
            </article>
          ))}
        </div>
      </section>

      <AccessibleModal
        title={selectedArtwork?.title ?? "Artwork preview"}
        isOpen={selectedArtwork !== null}
        onClose={() => setSelectedArtwork(null)}
      >
        {selectedArtwork ? (
          <div className="modal-artwork">
            <img src={selectedArtwork.image} alt={selectedArtwork.alt} />
            <p className="price">{selectedArtwork.price}</p>
            <a href={inquiryHref(selectedArtwork.title)}>Email purchase inquiry</a>
          </div>
        ) : null}
      </AccessibleModal>
    </>
  );
}
