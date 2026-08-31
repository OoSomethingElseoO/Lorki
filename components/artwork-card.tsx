"use client";

import { useState } from "react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { Button } from "@/components/ui/button";

type ArtworkCardProps = {
  artwork: StorefrontArtwork;
  customerEmail?: string;
  // ORIGINAL kind only — reports the clicked element's rect so a parent
  // grid can drive one shared lightbox with a grow-from-click transition
  // (see components/originals-grid.tsx). PRINT kind ignores this and keeps
  // its own local enlarge-on-image-click modal below.
  onSelect?: (originRect: DOMRect) => void;
};

export function ArtworkCard({ artwork, customerEmail, onSelect }: ArtworkCardProps) {
  const [enlarged, setEnlarged] = useState(false);
  const isOriginal = artwork.kind === "ORIGINAL";

  function handleImageClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (isOriginal) {
      onSelect?.(event.currentTarget.getBoundingClientRect());
    } else {
      setEnlarged(true);
    }
  }

  return (
    <article className="artwork-card">
      <button
        type="button"
        className="artwork-card__image-button"
        aria-label={`Enlarge ${artwork.title}`}
        onClick={handleImageClick}
      >
        <img src={artwork.imageUrl} alt={artwork.altText} className="artwork-card__image" />
        <span className="artwork-card__image-hint" aria-hidden="true">
          Enlarge
        </span>
      </button>
      <div className="artwork-card__body">
        <h2>{artwork.title}</h2>
        <p>{artwork.artistName}</p>
        {isOriginal ? (
          <>
            <p className="price">${(artwork.priceCents / 100).toFixed(2)}</p>
            <Button type="button" onClick={(event) => onSelect?.(event.currentTarget.getBoundingClientRect())}>
              Inquire to purchase
            </Button>
          </>
        ) : (
          <BuyButton
            artworkId={artwork.id}
            title={artwork.title}
            priceCents={artwork.priceCents}
            customerEmail={customerEmail}
          />
        )}
      </div>

      {isOriginal ? null : (
        <AccessibleModal
          title={artwork.title}
          isOpen={enlarged}
          onClose={() => setEnlarged(false)}
          closeLabel="Close enlarged artwork"
        >
          <div className="modal-artwork">
            <img src={artwork.imageUrl} alt={artwork.altText} />
          </div>
        </AccessibleModal>
      )}
    </article>
  );
}
