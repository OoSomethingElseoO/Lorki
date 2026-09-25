"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import type { StorefrontArtwork } from "@/lib/storefront";
import { AccessibleModal } from "@/components/accessible-modal";
import { BuyButton } from "@/components/buy-button";
import { InquiryForm } from "@/components/inquiry-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FallbackImage } from "@/components/ui/fallback-image";


export type ArtworkLightboxProps = {
  artwork: StorefrontArtwork | null;
  // The clicked card's on-screen rect, for the grow-from transition.
  // Optional — if absent, just fade/scale in from center, no origin morph.
  originRect?: DOMRect | null;
  /** Re-read the originating card position before closing. */
  getOriginRect?: () => DOMRect | null;
  onClose: () => void;
  customerEmail?: string;
  // Both omitted (undefined) when there's nothing to browse to — e.g. a
  // single-item set — so the arrows/keyboard handling simply don't render
  // rather than wrapping around a set of one.
  onNext?: () => void;
  onPrevious?: () => void;
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

export function ArtworkLightbox({
  artwork,
  originRect,
  getOriginRect,
  onClose,
  customerEmail,
  onNext,
  onPrevious,
}: ArtworkLightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The rect to morph back into on close, captured at open time — `originRect`
  // itself may change identity (or the page may scroll) by the time close fires.
  const closeRectRef = useRef<DOMRect | null>(null);
  const transitionCloneRef = useRef<HTMLImageElement | null>(null);
  const isOpen = artwork !== null;

  // Left/Right browse to the adjacent piece without closing. Scoped to a
  // plain window listener rather than AccessibleModal's own onKeyDown (that
  // one only handles Escape/Tab) — only attached while actually open, so it
  // can't fire against a stray arrow-key press anywhere else on the page.
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight" && onNext) {
        event.preventDefault();
        onNext();
      } else if (event.key === "ArrowLeft" && onPrevious) {
        event.preventDefault();
        onPrevious();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onNext, onPrevious]);

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

    const stage = panel.querySelector<HTMLElement>(".modal-artwork-stage");
    const targetImage = stage?.querySelector<HTMLImageElement>("img");
    if (!stage || !targetImage) return;

    // Animate a visual copy of the clicked image into the standardized modal
    // stage. The panel can appear immediately without squashing its content;
    // only the artwork itself travels continuously from card to lightbox.
    const targetRect = targetImage.getBoundingClientRect();
    const clone = targetImage.cloneNode(true) as HTMLImageElement;
    Object.assign(clone.style, {
      position: "fixed",
      top: `${originRect.top}px`,
      left: `${originRect.left}px`,
      width: `${originRect.width}px`,
      height: `${originRect.height}px`,
      objectFit: "cover",
      zIndex: "1000",
      pointerEvents: "none",
      margin: "0",
    });
    document.body.appendChild(clone);
    transitionCloneRef.current = clone;
    targetImage.style.visibility = "hidden";
    gsap.fromTo(
      panel,
      { autoAlpha: 0.15 },
      { autoAlpha: 1, duration: 0.3, ease: "power2.out" },
    );
    gsap.to(clone, {
      top: targetRect.top,
      left: targetRect.left,
      width: targetRect.width,
      height: targetRect.height,
      duration: 0.6,
      ease: "power3.inOut",
      onComplete: () => {
        targetImage.style.visibility = "visible";
        clone.remove();
        transitionCloneRef.current = null;
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleClose() {
    const panel = contentRef.current?.closest<HTMLElement>(".modal-panel");
    const closeRect = getOriginRect?.() ?? closeRectRef.current;

    if (!panel || prefersReducedMotion() || !closeRect || !isRectStillUsable(closeRect)) {
      onClose();
      return;
    }
    const stage = panel.querySelector<HTMLElement>(".modal-artwork-stage");
    const image = stage?.querySelector<HTMLImageElement>("img");
    if (!stage || !image) {
      onClose();
      return;
    }
    const imageRect = image.getBoundingClientRect();
    const clone = image.cloneNode(true) as HTMLImageElement;
    Object.assign(clone.style, {
      position: "fixed", top: `${imageRect.top}px`, left: `${imageRect.left}px`,
      width: `${imageRect.width}px`, height: `${imageRect.height}px`,
      objectFit: "contain", zIndex: "1000", pointerEvents: "none", margin: "0",
    });
    document.body.appendChild(clone);
    image.style.visibility = "hidden";
    transitionCloneRef.current = clone;
    gsap.to(panel, { autoAlpha: 0.15, duration: 0.45, ease: "power2.in" });
    gsap.to(clone, {
      top: closeRect.top, left: closeRect.left,
      width: closeRect.width, height: closeRect.height,
      duration: 0.5, ease: "power3.in",
      onComplete: () => { clone.remove(); transitionCloneRef.current = null; onClose(); },
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
        <div ref={contentRef}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="modal-artwork-stage relative flex items-center justify-center border-2 border-line bg-panel/80 p-3">
              <FallbackImage
                src={artwork.imageUrl}
                alt={artwork.altText}
                loading="eager"
                decoding="async"
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
              {onPrevious ? (
                <button
                  type="button"
                  onClick={onPrevious}
                  aria-label="Previous artwork"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              {onNext ? (
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next artwork"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
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
                  // Keyed by artworkId: Next/Previous swaps `artwork` without
                  // this component ever unmounting, and InquiryForm/BuyButton
                  // both hold their own name/email/sent state internally — a
                  // stable key across pieces would carry that state (or a
                  // just-submitted "Sent!" confirmation) over onto whichever
                  // piece is showing next.
                  <InquiryForm key={artwork.id} artworkId={artwork.id} title={artwork.title} customerEmail={customerEmail} />
                ) : (
                  <BuyButton
                    key={artwork.id}
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

          {/* Sticky, not just trailing content — .modal-panel scrolls
              internally (overflow: auto) and this piece's full content can
              run taller than the viewport, which left a plain in-flow Back
              button below the fold, unreachable without scrolling past
              everything else first. */}
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-6 flex justify-start border-t-2 border-line bg-panel px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              <ArrowLeft size={16} />
              Back
            </Button>
          </div>
        </div>
      ) : null}
    </AccessibleModal>
  );
}
