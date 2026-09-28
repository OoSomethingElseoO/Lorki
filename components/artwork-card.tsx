"use client";

import { useState } from "react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { Button } from "@/components/ui/button";
import { FallbackImage } from "@/components/ui/fallback-image";
import { PrintVariantPicker } from "@/components/print-variant-picker";

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
  const [variantId, setVariantId] = useState(artwork.printVariants[0]?.id ?? "");
  const isOriginal = artwork.kind === "ORIGINAL";
  const selectedVariant = artwork.printVariants.find((variant) => variant.id === variantId);
  const selectedPriceCents = selectedVariant?.priceCents ?? artwork.priceCents;

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
        <FallbackImage
          src={artwork.imageUrl}
          alt={artwork.altText}
          className="artwork-card__image"
          loading="lazy"
          fetchPriority="low"
          decoding="async"
        />
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
          <>
            <PrintVariantPicker variants={artwork.printVariants} value={variantId} onChange={setVariantId} />
            <BuyButton artworkId={artwork.id} variantId={selectedVariant?.id} title={artwork.title} priceCents={selectedPriceCents} customerEmail={customerEmail} />
          </>
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
            <FallbackImage src={artwork.imageUrl} alt={artwork.altText} loading="eager" decoding="async" />
            <PrintVariantPicker variants={artwork.printVariants} value={variantId} onChange={setVariantId} />
            <BuyButton artworkId={artwork.id} variantId={selectedVariant?.id} title={artwork.title} priceCents={selectedPriceCents} customerEmail={customerEmail} />
          </div>
        </AccessibleModal>
      )}
    </article>
  );
}
