"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";
import { cn } from "@/lib/utils";

gsap.registerPlugin(Flip);

export type ArtworkLightboxProps = {
  artwork: StorefrontArtwork | null;
  // The clicked card's on-screen rect, for the grow-from transition.
  // Optional — if absent, just fade/scale in from center, no origin morph.
  originRect?: DOMRect | null;
  onClose: () => void;
  customerEmail?: string;
};

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// A rect captured at click time can go stale — the page may have scrolled
// far enough since that shrinking the panel back into it would fly off in a
// way that reads as broken rather than intentional. This is a coarse
// "is it still roughly on-screen" check, not a precise one; a plain fade
// fallback is fine once it fails.
function isRectStillUsable(rect: DOMRect): boolean {
  if (typeof window === "undefined") return false;
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;
  return (
    rect.bottom > -viewportHeight &&
    rect.top < viewportHeight * 2 &&
    rect.right > -viewportWidth &&
    rect.left < viewportWidth * 2
  );
}

export function ArtworkLightbox({ artwork, originRect, onClose, customerEmail }: ArtworkLightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The rect to morph back into on close, captured at open time — `originRect`
  // itself may change identity (or the page may scroll) by the time close fires.
  const closeRectRef = useRef<DOMRect | null>(null);
  const isOpen = artwork !== null;

  // Runs once per null -> real-value transition (see `isOpen` dependency),
  // matching the spec's "when artwork transitions from null to a real
  // value" trigger rather than firing on every artwork/originRect change
  // while the lightbox stays open.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    const panel = contentRef.current?.closest<HTMLElement>(".modal-panel");
    if (!panel) {
      return;
    }

    if (prefersReducedMotion()) {
      closeRectRef.current = null;
      return;
    }

    if (!originRect) {
      closeRectRef.current = null;
      gsap.fromTo(
        panel,
        { autoAlpha: 0, scale: 0.94 },
        { autoAlpha: 1, scale: 1, duration: 0.35, ease: "power2.out", clearProps: "opacity,visibility,transform" },
      );
      return;
    }

    closeRectRef.current = originRect;

    // Snap the panel to the clicked card's exact screen box (before the
    // browser paints), capture that as the Flip "from" state, then release
    // it back to its natural full-size layout and let Flip tween smoothly
    // between the two — the "grow from where you clicked" effect.
    gsap.set(panel, {
      position: "fixed",
      top: originRect.top,
      left: originRect.left,
      width: originRect.width,
      height: originRect.height,
      margin: 0,
    });
    const state = Flip.getState(panel);
    gsap.set(panel, { clearProps: "position,top,left,width,height,margin" });
    Flip.from(state, {
      targets: panel,
      duration: 0.55,
      ease: "power3.inOut",
      absolute: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    const panel = contentRef.current?.closest<HTMLElement>(".modal-panel");
    const closeRect = closeRectRef.current;

    if (!panel || prefersReducedMotion() || !closeRect || !isRectStillUsable(closeRect)) {
      onClose();
      return;
    }

    gsap.to(panel, {
      position: "fixed",
      top: closeRect.top,
      left: closeRect.left,
      width: closeRect.width,
      height: closeRect.height,
      margin: 0,
      duration: 0.4,
      ease: "power3.in",
      onComplete: onClose,
    });
  }

  return (
    <AccessibleModal
      title={artwork?.title ?? ""}
      isOpen={isOpen}
      onClose={handleClose}
      closeLabel={artwork ? `Close ${artwork.title}` : "Close dialog"}
    >
      {artwork ? (
        <div ref={contentRef} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex items-center justify-center border-2 border-line bg-panel/80 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={artwork.imageUrl}
              alt={artwork.altText}
              loading="eager"
              decoding="async"
              className="max-h-[75vh] w-auto max-w-full object-contain"
            />
          </div>

          <div className="flex flex-col gap-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                {artwork.kind === "ORIGINAL" ? "Original" : "Print"}
              </p>
              <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink">
                {artwork.title}
              </h3>
              <p className="mt-2 text-muted">
                <Link
                  href={`/artists/${artwork.artistSlug}`}
                  className="underline decoration-line underline-offset-4 hover:text-ink"
                >
                  {artwork.artistName}
                </Link>
                {" · "}
                {artwork.artistCountry}
              </p>
            </div>

            {artwork.story ? (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">About this piece</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">{artwork.story}</p>
              </div>
            ) : null}

            <p className="text-2xl font-bold text-ink">${(artwork.priceCents / 100).toFixed(2)}</p>

            <div className="border-t-2 border-line pt-5">
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

            {artwork.artistBio ? (
              <div className="border-t-2 border-line pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">About the artist</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">{artwork.artistBio}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </AccessibleModal>
  );
}
