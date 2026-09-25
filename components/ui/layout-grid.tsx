"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type LayoutGridCard = {
  id: string | number;
  content: React.ReactNode;
  thumbnail: string;
  alt: string;
  className?: string;
  topContent?: React.ReactNode;
  hoverContent?: React.ReactNode;
};

type LayoutGridProps = {
  cards: LayoutGridCard[];
  className?: string;
  onCardSelect?: (card: LayoutGridCard) => void;
};

/**
 * Accessible shared-layout gallery. The selected card remains the same
 * layoutId as it expands, so the image travels continuously instead of
 * disappearing and reappearing in a separate modal.
 */
export function LayoutGrid({ cards, className, onCardSelect }: LayoutGridProps) {
  const [selected, setSelected] = React.useState<LayoutGridCard | null>(null);

  React.useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelected(null);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected]);

  return (
    <div className={cn("layout-grid", className)}>
      {cards.map((card) => (
        <motion.div
          key={card.id}
          onClick={() => (onCardSelect ? onCardSelect(card) : setSelected(card))}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onCardSelect ? onCardSelect(card) : setSelected(card);
            }
          }}
          className={cn("layout-grid__card", card.className)}
          role="button"
          tabIndex={0}
          aria-label={`Open ${card.alt}`}
        >
          <motion.img
            // Match SharedArtworkModal's image layout id so the selected
            // artwork itself expands into the detail surface on every gallery
            // path, rather than the modal rendering a second image.
            layoutId={`artwork-image-${card.id}`}
            src={card.thumbnail}
            alt={card.alt}
            className="layout-grid__image"
          />
          {card.topContent ? <div className="layout-grid__top-meta">{card.topContent}</div> : null}
          {card.hoverContent ? <div className="layout-grid__hover-meta">{card.hoverContent}</div> : null}
        </motion.div>
      ))}

      {!onCardSelect ? <AnimatePresence>
        {selected ? (
          <motion.div
            className="layout-grid__backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
            role="presentation"
          >
            <motion.article
              role="dialog"
              aria-modal="true"
              aria-label={selected.alt}
              className="layout-grid__selected"
              onClick={(event) => event.stopPropagation()}
            >
              <motion.img
                layoutId={`artwork-image-${selected.id}`}
                src={selected.thumbnail}
                alt={selected.alt}
                className="layout-grid__selected-image"
              />
              <div className="layout-grid__content">{selected.content}</div>
              <button type="button" className="layout-grid__close" onClick={() => setSelected(null)}>
                Close
              </button>
            </motion.article>
          </motion.div>
        ) : null}
      </AnimatePresence> : null}
    </div>
  );
}
