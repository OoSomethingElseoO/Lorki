"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { AccessibleModal } from "@/components/accessible-modal";
import { Button, buttonVariants } from "@/components/ui/button";
import { FallbackImage } from "@/components/ui/fallback-image";
import { cn } from "@/lib/utils";

gsap.registerPlugin(Flip);

export type ArtistLightboxProps = {
  artist: { slug: string; name: string; country: string; bio: string; imageUrl: string } | null; // null = closed
  // The clicked card's on-screen rect, for the grow-from transition.
  // Optional — if absent, just fade/scale in from center, no origin morph.
  originRect?: DOMRect | null;
  onClose: () => void;
  // Both omitted (undefined) when there's nothing to browse to — e.g. a
  // single-item set — so the arrows/keyboard handling simply don't render.
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

export function ArtistLightbox({ artist, originRect, onClose, onNext, onPrevious }: ArtistLightboxProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // The rect to morph back into on close, captured at open time — `originRect`
  // itself may change identity (or the page may scroll) by the time close fires.
  const closeRectRef = useRef<DOMRect | null>(null);
  const isOpen = artist !== null;

  // Left/Right browse to the adjacent artist without closing — same
  // reasoning as ArtworkLightbox's identical effect: a plain window
  // listener, only attached while open, since AccessibleModal's own
  // onKeyDown only covers Escape/Tab.
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
  // matching the spec's "when artist transitions from null to a real
  // value" trigger rather than firing on every artist/originRect change
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
    // between the two — the "grow from where you clicked" effect. The
    // clicked card's rect comes from a plain getBoundingClientRect() taken
    // outside CardStack's 3D fan transforms, so it's an honest flat 2D
    // rect — safe for Flip, unlike trying to Flip something still inside
    // the fan's own rotateZ/rotateX/translateZ space.
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
      title={artist?.name ?? ""}
      isOpen={isOpen}
      onClose={handleClose}
      closeLabel={artist ? `Close ${artist.name}` : "Close dialog"}
    >
      {artist ? (
        <div ref={contentRef}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="relative flex items-center justify-center border-2 border-line bg-panel/80 p-3">
              <FallbackImage
                src={artist.imageUrl}
                alt={`Portrait of ${artist.name}`}
                loading="eager"
                decoding="async"
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
              {onPrevious ? (
                <button
                  type="button"
                  onClick={onPrevious}
                  aria-label="Previous artist"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              {onNext ? (
                <button
                  type="button"
                  onClick={onNext}
                  aria-label="Next artist"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
                >
                  <ChevronRight size={20} />
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Artist</p>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl leading-tight text-ink">
                  {artist.name}
                </h3>
                <p className="mt-2 text-muted">{artist.country}</p>
              </div>

              <div className="border-t-2 border-line pt-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">About the artist</p>
                <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">{artist.bio}</p>
              </div>

              <div className="border-t-2 border-line pt-5">
                <Link href={`/artists/${artist.slug}`} className={cn(buttonVariants(), "w-fit")}>
                  View full profile
                </Link>
              </div>
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
