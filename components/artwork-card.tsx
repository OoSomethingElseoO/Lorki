"use client";

import { useState } from "react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";

type ArtworkCardProps = {
  artwork: StorefrontArtwork;
  customerEmail?: string;
};

export function ArtworkCard({ artwork, customerEmail }: ArtworkCardProps) {
  const [enlarged, setEnlarged] = useState(false);

  return (
    <article className="artwork-card">
      <button
        type="button"
        className="artwork-card__image-button"
        aria-label={`Enlarge ${artwork.title}`}
        onClick={() => setEnlarged(true)}
      >
        <img src={artwork.imageUrl} alt={artwork.altText} className="artwork-card__image" />
        <span className="artwork-card__image-hint" aria-hidden="true">
          Enlarge
        </span>
      </button>
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
    </article>
  );
}
