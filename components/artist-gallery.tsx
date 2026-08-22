"use client";

import { useState } from "react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";

type ArtistGalleryProps = {
  artworks: StorefrontArtwork[];
  customerEmail?: string;
};

export function ArtistGallery({ artworks, customerEmail }: ArtistGalleryProps) {
  const [selectedArtwork, setSelectedArtwork] = useState<StorefrontArtwork | null>(null);

  return (
    <>
      <section className="artist-gallery-section" aria-labelledby="artist-gallery-title">
        <h2 id="artist-gallery-title">Available Artwork</h2>
        {artworks.length === 0 ? <p>No artwork available from this artist right now.</p> : null}
        <div className="gallery-scroll" aria-label="Scrollable artwork gallery">
          {artworks.map((artwork) => (
            <article className="gallery-card" key={artwork.id}>
              <button
                type="button"
                className="gallery-card__image-button"
                aria-label={`Enlarge ${artwork.title}`}
                onClick={() => setSelectedArtwork(artwork)}
              >
                <img src={artwork.imageUrl} alt={artwork.altText} />
              </button>
              <h3>{artwork.title}</h3>
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
            <img src={selectedArtwork.imageUrl} alt={selectedArtwork.altText} />
            {selectedArtwork.kind === "ORIGINAL" ? (
              <InquiryForm artworkId={selectedArtwork.id} title={selectedArtwork.title} customerEmail={customerEmail} />
            ) : (
              <BuyButton
                artworkId={selectedArtwork.id}
                title={selectedArtwork.title}
                priceCents={selectedArtwork.priceCents}
                customerEmail={customerEmail}
              />
            )}
          </div>
        ) : null}
      </AccessibleModal>
    </>
  );
}
