"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import type { StorefrontArtwork } from "@/lib/storefront";
import { InquiryForm } from "@/components/inquiry-form";
import { ShareButton } from "@/components/share-button";

type SharedArtworkModalProps = {
  artwork: StorefrontArtwork | null;
  onClose: () => void;
  customerEmail?: string;
};

export function SharedArtworkModal({ artwork, onClose, customerEmail }: SharedArtworkModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!artwork) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [artwork, onClose]);

  if (!mounted) return null;

  return createPortal((
    <AnimatePresence>
      {artwork ? (
        <motion.div className="artwork-shared-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} role="presentation">
          <motion.article
            className="artwork-shared-surface"
            role="dialog"
            aria-modal="true"
            aria-label={artwork.title}
            onClick={(event) => event.stopPropagation()}
          >
            <motion.div layoutId={`artwork-image-${artwork.id}`} className="artwork-shared-image">
              <div className="artwork-shared-image-price">
                ${(artwork.priceCents / 100).toFixed(2)}
              </div>
              <img src={artwork.imageUrl} alt={artwork.altText} />
            </motion.div>
            <div className="artwork-shared-details">
              <div className="artwork-shared-topbar">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Original</p>
                <div className="artwork-shared-actions">
                  <ShareButton
                    url={`/artworks/${artwork.id}`}
                    title={`${artwork.title} — Lorki Originals`}
                    text={`View ${artwork.title} by ${artwork.artistName}.`}
                    targetType="artwork"
                    targetId={artwork.id}
                  />
                  <a className="artwork-shared-cta" href={`#inquiry-${artwork.id}`}>Inquire to purchase</a>
                </div>
              </div>
              <div className="artwork-shared-copy">
                <h2>{artwork.title}</h2>
                <p className="text-muted">{artwork.artistName} · {artwork.artistCountry}</p>
                {artwork.story ? <p className="whitespace-pre-line leading-relaxed text-ink">{artwork.story}</p> : null}
              </div>
              <div id={`inquiry-${artwork.id}`} className="artwork-shared-checkout">
                <InquiryForm formId={`inquiry-${artwork.id}`} artworkId={artwork.id} title={artwork.title} customerEmail={customerEmail} />
              </div>
              <button type="button" className="artwork-shared-close" onClick={onClose}>Close</button>
            </div>
          </motion.article>
        </motion.div>
      ) : null}
    </AnimatePresence>
  ), document.body);
}
