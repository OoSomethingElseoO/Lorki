"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

type AccessibleModalProps = {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
};

export function AccessibleModal({ title, isOpen, onClose, children, closeLabel = "Close dialog" }: AccessibleModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    // Keep keyboard focus inside the lightbox until the visitor closes it.
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key !== "Tab") {
        return;
      }

      // Recalculated fresh on every keydown (not cached) so a control that
      // becomes enabled/disabled after the modal opens — e.g. a submit
      // button gated on checkboxes being checked — is picked up correctly.
      const focusableElements = [
        ...document.querySelectorAll<HTMLElement>(
          [
            ".modal-panel a[href]",
            ".modal-panel button:not([disabled])",
            ".modal-panel input:not([disabled]):not([type='hidden'])",
            ".modal-panel select:not([disabled])",
            ".modal-panel textarea:not([disabled])",
          ].join(", "),
        ),
      ];

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) {
        return;
      }

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.body.classList.add("modal-open");
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.classList.remove("modal-open");
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  // Portaled straight to <body> instead of rendering inline wherever the
  // caller happens to put it: .modal-backdrop is position: fixed, and a
  // fixed element repositions relative to the nearest ancestor that has a
  // CSS transform (per spec) instead of the viewport. ArtworkCard's own
  // lightbox call site sits inside .artwork-card, which gets
  // transform: translateY(...) on :hover — without the portal, hovering
  // the enlarged image made :hover on .artwork-card true, which shifted
  // the whole modal out from under the cursor, dropping :hover, shifting
  // it back, and repeating in a flicker loop the user couldn't click
  // through. A portal makes the modal immune to this regardless of what
  // hover/transform styling any future call site's ancestors happen to
  // have.
  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-panel__header">
          <h2 id="modal-title">{title}</h2>
          <Button
            variant="icon-panel"
            size="icon"
            type="button"
            aria-label={closeLabel}
            onClick={onClose}
            ref={closeButtonRef}
          >
            <span aria-hidden="true">X</span>
          </Button>
        </div>
        {children}
      </section>
    </div>,
    document.body,
  );
}
