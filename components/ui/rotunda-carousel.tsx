"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowLeft, ArrowRight, ArrowUpRight, CircleUserRound, Orbit, ScanLine, ShoppingBag } from "lucide-react";
import Link from "next/link";

import { FallbackImage } from "@/components/ui/fallback-image";
import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export type RotundaSlide = {
  id: string;
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  artistHref?: string;
  price?: string;
};

export type RotundaCarouselProps = {
  slides: RotundaSlide[];
  onSelect?: (index: number, originRect: DOMRect) => void;
  onActiveChange?: (index: number) => void;
  /** Ambient rotation speed, degrees per second. */
  speed?: number;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
};

function FlatArtworkSlot({
  slide,
  slot,
  allowChange,
  transitionDirection,
}: {
  slide: RotundaSlide;
  slot: number;
  allowChange: boolean;
  transitionDirection: -1 | 1 | null;
}) {
  const [visible, setVisible] = React.useState(slide);
  const [hovered, setHovered] = React.useState(false);

  React.useEffect(() => {
    if (!allowChange || hovered || slide.id === visible.id) return;

    // Do not replace every card in the batch at once. Keep the old artwork
    // visible while the next one is loading, then let this slot crossfade on
    // its own schedule. The slot wrapper never changes size or identity.
    const delay = transitionDirection
      ? (transitionDirection === 1 ? slot : GRID_BATCH_SIZE - 1 - slot) * 110
      : 260 + Math.floor(Math.random() * 900) + (slot % 3) * 80;
    const timer = window.setTimeout(() => {
      const preload = new window.Image();
      const commit = () => setVisible(slide);
      preload.onload = commit;
      preload.onerror = commit;
      preload.src = slide.src;
    }, delay);
    return () => window.clearTimeout(timer);
  }, [allowChange, hovered, slide, slot, transitionDirection, visible.id]);

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ aspectRatio: String(FLAT_SLOT_RATIOS[slot % FLAT_SLOT_RATIOS.length]) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
    >
      {/* Each slot owns its varied shape; artwork replacements cannot resize it. */}
      <AnimatePresence initial={false} mode="sync">
        <motion.div
          key={visible.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <FallbackImage
            src={visible.src}
            alt={visible.alt}
            draggable={false}
            loading="lazy"
            decoding="async"
            className="block h-full w-full select-none object-cover"
          />
          <div className="rotunda-card__price">{visible.price ?? ""}</div>
          <button type="button" className="rotunda-card__purchase" aria-label="Buy artwork" title="Buy artwork">
            <ShoppingBag className="size-4" aria-hidden="true" />
          </button>
          {(visible.title || visible.subtitle) ? (
            <div className="rotunda-card__hover-meta">
              {visible.title ? <strong>{visible.title}</strong> : null}
              {visible.subtitle ? (
                visible.artistHref ? (
                  <Link className="rotunda-card__artist-link" href={visible.artistHref} onClick={(event) => event.stopPropagation()}>
                    <CircleUserRound className="size-3.5" aria-hidden="true" />
                    <span>{visible.subtitle}</span>
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : <span>{visible.subtitle}</span>
              ) : null}
            </div>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Everything else (radius, perspective) is derived from these, so the whole
// rig scales together instead of one dimension outrunning the other.
// Larger artwork cards keep the rotunda visually substantial at desktop
// widths while retaining usable tiles on phones.
const CARD_W = "clamp(220px, 22vw, 560px)";
const CARD_H = "clamp(300px, 32vw, 700px)";
const GRID_BATCH_SIZE = 12;
const NAV_SHIMMER_DURATION = 1100;
const FLAT_SLOT_RATIOS = [0.78, 1.08, 0.9, 1.22, 0.84, 1.14, 0.96, 1.18, 0.82, 1.06, 0.92, 1.16];

function pickFlatSlots(slotCount: number, previous: Set<number>) {
  const candidates = Array.from({ length: slotCount }, (_, index) => index)
    .filter((index) => !previous.has(index));
  const pool = candidates.length >= Math.min(2, slotCount)
    ? candidates
    : Array.from({ length: slotCount }, (_, index) => index);
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return new Set(pool.slice(0, Math.min(2, slotCount)));
}

/** Fold a rotation into -180..180 — the shorter way round the ring. */
function foldAngle(deg: number) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a < -180) a += 360;
  return a;
}

export function RotundaCarousel({
  slides,
  onSelect,
  onActiveChange,
  speed = 5,
  label = "Rotating gallery",
  className,
}: RotundaCarouselProps) {
  const count = slides.length;

  const frameRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);

  /** Single source of truth for ring rotation, in degrees. Not wrapped —
      GSAP's relative "+=360" tween relies on it climbing forever. */
  const rotation = React.useRef({ deg: 0 });
  const radiusRef = React.useRef(0);
  const widthRef = React.useRef(0);

  const ambientTweenRef = React.useRef<gsap.core.Tween | null>(null);
  const inertiaTweenRef = React.useRef<gsap.core.Tween | null>(null);
  const boostProxyRef = React.useRef({ scale: 1 });
  const boostTweenRef = React.useRef<gsap.core.Tween | null>(null);

  const isGridRef = React.useRef(false);
  const inViewRef = React.useRef(true);
  const manualPausedRef = React.useRef(false);
  const activeIndexRef = React.useRef(0);
  const movedRef = React.useRef(false);
  const didMountFlipRef = React.useRef(false);

  const dragRef = React.useRef<{
    id: number;
    x: number;
    startDeg: number;
    v: number;
    t: number;
  } | null>(null);

  const [isGrid, setIsGrid] = React.useState(false);
  const [manualPaused, setManualPaused] = React.useState(false);
  const [gridPage, setGridPage] = React.useState(0);
  const [flatChangeSlots, setFlatChangeSlots] = React.useState<Set<number>>(() => new Set([0, 1]));
  const previousFlatSlotsRef = React.useRef(new Set<number>([0, 1]));
  const [flatTransitionDirection, setFlatTransitionDirection] = React.useState<-1 | 1 | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [navVisual, setNavVisual] = React.useState<{
    which: "previous" | "next";
    phase: "running" | "paused" | "finishing" | "fading";
  } | null>(null);
  const shimmerTimerRef = React.useRef<number | null>(null);
  const shimmerPauseTimerRef = React.useRef<number | null>(null);
  const shimmerStartedAtRef = React.useRef(0);
  const navPausedAmbientRef = React.useRef(false);
  const navSlowProxyRef = React.useRef({ scale: 1 });
  const navSlowTweenRef = React.useRef<gsap.core.Tween | null>(null);

  // Pause is deliberate, button-only — the visitor chooses, not a hover
  // side-effect that fights them for control.
  const paused = manualPaused;

  // Paint straight to the DOM — sixty rotation updates a second have no
  // business round-tripping through React.
  const paint = React.useCallback(() => {
    // Switching ring<->grid changes the frame's box size, which fires the
    // ResizeObserver below (via measure()) regardless of what triggered
    // the switch. Without this guard, that reasserts ring transforms onto
    // cards that are now in plain grid-flow layout — exactly the kind of
    // stale inline transform/opacity/z-index that made the grid look
    // broken (a card visually flying off outside the viewport).
    if (isGridRef.current) return;
    const radius = radiusRef.current;
    if (!radius || !count) return;
    if (frameRef.current && ambientTweenRef.current) {
      frameRef.current.dataset.ambientScale = String(ambientTweenRef.current.timeScale());
    }
    const step = 360 / count;
    const rot = rotation.current.deg;

    let nearest = 0;
    let nearestDist = Infinity;

    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const angle = index * step + rot;
      const folded = foldAngle(angle);
      const distance = Math.abs(folded);
      if (distance < nearestDist) {
        nearestDist = distance;
        nearest = index;
      }

      card.style.transform = `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`;
      // Faces turned away fade and drop back so the front of the ring reads
      // clearly against whatever is behind it.
      const facing = (Math.cos((folded * Math.PI) / 180) + 1) / 2;
      card.style.opacity = String(0.35 + 0.65 * facing);
      card.style.zIndex = String(Math.round(facing * 100));
    });

    if (nearest !== activeIndexRef.current) {
      activeIndexRef.current = nearest;
      onActiveChange?.(nearest);
    }
  }, [count, onActiveChange]);

  const playAmbient = React.useCallback(() => {
    if (reducedMotion) return;
    if (isGridRef.current) return;
    if (manualPausedRef.current) return;
    if (!inViewRef.current) return;
    if (dragRef.current) return;
    if (!radiusRef.current) return;

    ambientTweenRef.current?.kill();
    const duration = 360 / Math.max(0.0001, speed);
    ambientTweenRef.current = gsap.to(rotation.current, {
      deg: "+=360",
      duration,
      ease: "none",
      repeat: -1,
      onUpdate: paint,
    });
  }, [reducedMotion, speed, paint]);

  // Mount / speed changes own the ambient tween's lifecycle; every other
  // pause/resume path (hover, IO, drag, the crossfade) just calls
  // playAmbient again.
  React.useEffect(() => {
    if (!reducedMotion) playAmbient();
    return () => {
      ambientTweenRef.current?.kill();
      ambientTweenRef.current = null;
    };
  }, [reducedMotion, playAmbient]);

  // Detect prefers-reduced-motion. When set, the ring never spins at all —
  // render the grid straight away and skip every animated path.
  useIsoLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReducedMotion(mq.matches);
      if (mq.matches) {
        isGridRef.current = true;
        setIsGrid(true);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Card width alone used to drive the ring radius, which pinned the ring's
  // total spread to a near-constant ~18% slice of the frame no matter how
  // wide the frame got — cards grew with the viewport, but the *ring*
  // didn't, so wide screens read as a small centered cluster adrift in
  // empty margins. Radius is now the larger of two candidates: the
  // geometric minimum that just keeps cards from overlapping (still
  // card-width-driven, and what fully governs small screens, where it's
  // always the bigger of the two), and a target tied to the frame's own
  // width that ramps the ring's spread from ~30% of frame width up to ~60%
  // between 1440px and 2560px. Below 1440px the ramp is floored at 30%,
  // under which the no-overlap minimum wins anyway — so mobile/tablet is
  // unaffected and only wide desktop frames actually open up.
  useIsoLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !count) return;

    const measure = () => {
      const card = cardRefs.current[0];
      if (!card) return;
      widthRef.current = card.offsetWidth;
      // count=1 or 2 hits tan(90deg) here, which collapses the radius to
      // ~0 and stacks the cards on top of each other — floor the divisor
      // at 3 cards' worth of spacing so a small catalog still fans out.
      const denom = Math.tan(Math.PI / Math.max(count, 3));
      const noOverlapRadius = denom ? widthRef.current / 2 / denom : 0;

      const frameWidth = frame.offsetWidth;
      const spreadFraction = gsap.utils.clamp(0.3, 0.6, 0.3 + ((frameWidth - 1440) / (2560 - 1440)) * 0.3);
      const spreadRadius = (frameWidth * spreadFraction) / 2;

      radiusRef.current = Math.max(noOverlapRadius, spreadRadius);
      // Perspective as a fixed multiple of radius (rather than of card
      // width) keeps the front card's perspective-magnification ratio
      // constant regardless of how far the spread above pushes the ring
      // out — otherwise a bigger radius against an unchanged perspective
      // would inflate the near card further and reopen the vertical
      // clipping this multiple was tuned against (see the frame's
      // paddingBlock below).
      frame.style.perspective = radiusRef.current ? `${radiusRef.current * 6}px` : "";
      paint();
      if (!ambientTweenRef.current) playAmbient();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [count, paint, playAmbient]);

  // Scroll-velocity boost. Purely a read of ScrollTrigger's velocity signal —
  // no scrub, no pin, no preventDefault. The page scrolls exactly as normal.
  React.useEffect(() => {
    if (reducedMotion || !frameRef.current) return;

    const st = ScrollTrigger.create({
      trigger: frameRef.current,
      start: "top bottom+=200",
      end: "bottom top-=200",
      onUpdate: (self) => {
        if (!self.isActive) return;
        if (!ambientTweenRef.current) return;
        if (isGridRef.current || manualPausedRef.current) return;
        if (dragRef.current) return;

        const velocity = Math.abs(self.getVelocity());
        const boost = 1 + gsap.utils.clamp(0, 5, velocity / 600);
        if (boost > boostProxyRef.current.scale) {
          boostProxyRef.current.scale = boost;
          ambientTweenRef.current.timeScale(boost);
          boostTweenRef.current?.kill();
          boostTweenRef.current = gsap.to(boostProxyRef.current, {
            scale: 1,
            duration: 1.4,
            ease: "power3",
            overwrite: true,
            onUpdate: () => ambientTweenRef.current?.timeScale(boostProxyRef.current.scale),
          });
        }
      },
    });

    return () => st.kill();
  }, [reducedMotion]);

  // Ambient rotation only matters while the carousel is actually visible.
  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting;
        inViewRef.current = visible;
        if (visible) playAmbient();
        else ambientTweenRef.current?.pause();
      },
      { threshold: 0.01, rootMargin: "200px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [playAmbient]);

  // Pause (hover or the explicit control) swaps the ring for a flat grid;
  // unpausing swaps it back and hands off to the ambient tween. This is a
  // crossfade, not a Flip-driven position morph — a card's on-screen
  // bounding box in ring mode is warped by perspective/rotateY/translateZ,
  // often to a tiny foreshortened sliver for anything not facing the
  // camera. Flip.getState() honestly captures that sliver as the "from"
  // rect, then animates it toward the grid's full flat size — which reads
  // as cards visibly shrinking to fragments mid-transition, confirmed on
  // video. A 3D-projected element and a flat grid element don't have
  // comparable bounding boxes, so Flip is the wrong tool for this specific
  // jump; fading out, swapping layout while invisible, and fading in
  // sidesteps the mismatch entirely instead of fighting it.
  //
  // Still GSAP throughout (gsap.to for both the fade-out and fade-in) —
  // only the Flip plugin specifically is gone from this one transition.
  React.useEffect(() => {
    if (!didMountFlipRef.current) {
      didMountFlipRef.current = true;
      return;
    }
    if (reducedMotion || !count || !frameRef.current) return;

    if (paused) {
      ambientTweenRef.current?.kill();
      inertiaTweenRef.current?.kill();
    }

    gsap.to(frameRef.current, {
      opacity: 0,
      duration: 0.22,
      ease: "power1.in",
      onComplete: () => {
        isGridRef.current = paused;
        setIsGrid(paused);
      },
    });
  }, [paused, reducedMotion, count]);

  useIsoLayoutEffect(() => {
    if (!frameRef.current) return;

    const cards = cardRefs.current.filter((c): c is HTMLDivElement => !!c);
    if (isGrid) {
      cards.forEach((c) => {
        c.style.transform = "";
        c.style.opacity = "";
        c.style.zIndex = "";
      });
    } else {
      // Paint the ring targets immediately so the fade-in reveals cards
      // already in their spun positions, not converging from the centre.
      paint();
    }

    gsap.to(frameRef.current, {
      opacity: 1,
      duration: 0.28,
      ease: "power1.out",
      onComplete: () => {
        if (!isGrid) playAmbient();
      },
    });
  }, [isGrid]);

  const togglePause = () => {
    if (reducedMotion) return;
    const next = !manualPausedRef.current;
    manualPausedRef.current = next;
    setManualPaused(next);
  };

  const startNavShimmer = (which: "previous" | "next") => {
    if (shimmerTimerRef.current) window.clearTimeout(shimmerTimerRef.current);
    if (shimmerPauseTimerRef.current) window.clearTimeout(shimmerPauseTimerRef.current);
    shimmerStartedAtRef.current = performance.now();
    setNavVisual({ which, phase: "running" });
    if (!isGridRef.current && !manualPausedRef.current && ambientTweenRef.current) {
      navPausedAmbientRef.current = true;
      navSlowTweenRef.current?.kill();
      navSlowProxyRef.current.scale = ambientTweenRef.current.timeScale();
      navSlowTweenRef.current = gsap.to(navSlowProxyRef.current, {
        scale: 0,
        duration: (NAV_SHIMMER_DURATION * 0.5) / 1000,
        // A linear speed ramp makes the deceleration visibly continuous;
        // power2.out drops most of the speed in the first few frames and
        // reads as an immediate stop.
        ease: "none",
        overwrite: true,
        onUpdate: () => ambientTweenRef.current?.timeScale(navSlowProxyRef.current.scale),
      });
    }
    shimmerPauseTimerRef.current = window.setTimeout(() => {
      setNavVisual((current) => current?.which === which && current.phase === "running"
        ? { which, phase: "paused" }
        : current);
      shimmerPauseTimerRef.current = null;
    }, NAV_SHIMMER_DURATION * 0.5);
  };

  const finishNavShimmer = (which: "previous" | "next") => {
    if (shimmerTimerRef.current) window.clearTimeout(shimmerTimerRef.current);
    if (shimmerPauseTimerRef.current) window.clearTimeout(shimmerPauseTimerRef.current);
    const elapsed = performance.now() - shimmerStartedAtRef.current;
    const current = navVisual?.which === which ? navVisual.phase : "running";
    const remaining = current === "paused"
      ? NAV_SHIMMER_DURATION * 0.5
      : Math.max(0, NAV_SHIMMER_DURATION - elapsed);
    setNavVisual({ which, phase: "finishing" });
    if (navPausedAmbientRef.current && ambientTweenRef.current) {
      navSlowTweenRef.current?.kill();
      navSlowProxyRef.current.scale = ambientTweenRef.current.timeScale();
      navSlowTweenRef.current = gsap.to(navSlowProxyRef.current, {
        scale: 1,
        duration: Math.max(remaining, 1) / 1000,
        ease: "none",
        overwrite: true,
        onUpdate: () => ambientTweenRef.current?.timeScale(navSlowProxyRef.current.scale),
      });
    }
    shimmerTimerRef.current = window.setTimeout(() => {
      setNavVisual({ which, phase: "fading" });
      if (navPausedAmbientRef.current) {
        navPausedAmbientRef.current = false;
        navSlowTweenRef.current?.kill();
        if (!ambientTweenRef.current) playAmbient();
      }
      shimmerTimerRef.current = window.setTimeout(() => setNavVisual(null), 360);
    }, remaining);
  };

  const rotateByCard = (direction: 1 | -1) => {
    if (!count) return;
    if (isGridRef.current) {
      const pages = Math.max(1, Math.ceil(count / GRID_BATCH_SIZE));
      const slotCount = Math.min(GRID_BATCH_SIZE, count);
      const allSlots = new Set(Array.from({ length: slotCount }, (_, index) => index));
      previousFlatSlotsRef.current = allSlots;
      setFlatChangeSlots(allSlots);
      setFlatTransitionDirection(direction);
      setGridPage((page) => (page + direction + pages) % pages);
      return;
    }
    ambientTweenRef.current?.kill();
    inertiaTweenRef.current?.kill();
    gsap.to(rotation.current, {
      deg: rotation.current.deg + direction * (360 / count),
      duration: 0.8,
      ease: "power2.inOut",
      overwrite: true,
      onUpdate: paint,
      onComplete: playAmbient,
    });
  };

  React.useEffect(() => {
    if (!isGrid || count <= GRID_BATCH_SIZE) return;
    const timer = window.setInterval(() => {
      const pages = Math.max(1, Math.ceil(count / GRID_BATCH_SIZE));
      const slotCount = Math.min(GRID_BATCH_SIZE, count);
      const selectedSlots = pickFlatSlots(slotCount, previousFlatSlotsRef.current);
      previousFlatSlotsRef.current = selectedSlots;
      setFlatChangeSlots(selectedSlots);
      setFlatTransitionDirection(null);
      setGridPage((page) => (page + 1) % pages);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [count, isGrid]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isGridRef.current || reducedMotion || !count) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    movedRef.current = false;
    dragRef.current = {
      id: event.pointerId,
      x: event.clientX,
      startDeg: rotation.current.deg,
      v: 0,
      t: performance.now(),
    };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;

    const dx = event.clientX - drag.x;
    if (Math.abs(dx) > 4 && !movedRef.current) {
      movedRef.current = true;
      ambientTweenRef.current?.kill();
      ambientTweenRef.current = null;
      inertiaTweenRef.current?.kill();
    }

    const radius = radiusRef.current || 200;
    const deltaDeg = (dx / radius) * (180 / Math.PI);
    const now = performance.now();
    const prevDeg = rotation.current.deg;
    rotation.current.deg = drag.startDeg - deltaDeg;
    const dt = Math.max(now - drag.t, 1);
    drag.v = ((rotation.current.deg - prevDeg) / dt) * 1000;
    drag.t = now;
    paint();
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    dragRef.current = null;

    // A card's on-screen box keeps moving every frame while the ambient
    // tween runs. The browser's native `click` event only fires when
    // pointerdown and pointerup land on the same element — for a
    // continuously-animating 3D card, the coordinate a real mousedown used
    // can already be stale by the time pointerup fires a beat later, so the
    // click silently lands on nothing (confirmed: dispatching a click
    // programmatically works fine — it's specifically the native
    // down/up-must-match-target semantics that fails here). Resolving the
    // target from the pointer's actual release position, independent of
    // what pointerdown hit, sidesteps that entirely — pointerdown already
    // killed the ambient tween above, so nothing moves between down and up.
    if (!movedRef.current && !isGridRef.current) {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const eventTarget = event.target instanceof Element ? event.target : null;
      const cardEl = (target instanceof Element ? target.closest<HTMLElement>("[data-slide-index]") : null)
        ?? eventTarget?.closest<HTMLElement>("[data-slide-index]");
      if (cardEl) {
        const index = Number(cardEl.dataset.slideIndex);
        if (Number.isInteger(index)) {
          onSelect?.(index, cardEl.getBoundingClientRect());
        }
      }
      playAmbient();
      return;
    }

    // Let a flick carry and settle, then hand back to the ambient spin.
    const carried = gsap.utils.clamp(-900, 900, drag.v * 0.28);
    inertiaTweenRef.current?.kill();
    inertiaTweenRef.current = gsap.to(rotation.current, {
      deg: rotation.current.deg + carried,
      duration: 0.9,
      ease: "power3.out",
      onUpdate: paint,
      onComplete: () => {
        inertiaTweenRef.current = null;
        playAmbient();
      },
    });
  };

  React.useEffect(
    () => () => {
      ambientTweenRef.current?.kill();
      inertiaTweenRef.current?.kill();
      boostTweenRef.current?.kill();
      navSlowTweenRef.current?.kill();
      if (shimmerTimerRef.current) window.clearTimeout(shimmerTimerRef.current);
      if (shimmerPauseTimerRef.current) window.clearTimeout(shimmerPauseTimerRef.current);
    },
    [],
  );

  if (count === 0) return null;


  return (
    <div
      className={cn("rotunda-gallery w-full", className)}
      style={{ ["--rc-card-w" as string]: CARD_W, ["--rc-card-h" as string]: CARD_H }}
      role="region"
      aria-label={label}
    >
      <div className="rotunda-gallery__stage">
        <div
          ref={frameRef}
          tabIndex={-1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
              event.preventDefault();
              rotateByCard(event.key === "ArrowRight" ? 1 : -1);
            }
          }}
          className={cn(
            "outline-none",
            // Ring-mode cards are pushed out via translateZ/rotateY well
            // past the frame's own box — without clipping that, they
            // inflate the page's scrollable width and the whole site
            // scrolls sideways. Grid mode has nothing to clip.
            !isGrid && "cursor-grab select-none overflow-hidden active:cursor-grabbing",
          )}
          style={{
            // Set imperatively (frame.style.perspective) in the measure()
            // effect below, as a multiple of the JS-computed radius rather
            // than of CARD_W — see that effect's comment. This is just the
            // pre-measure fallback for the very first layout pass.
            perspective: isGrid ? undefined : `calc(var(--rc-card-w) * 6)`,
            touchAction: isGrid ? undefined : "pan-y",
            // The card nearest the camera sits closer to the eye than z=0,
            // so perspective projection scales it up beyond CARD_H — not a
            // bug, just how translateZ + perspective render. That growth is
            // a fixed fraction of CARD_H (bigger rings, i.e. more slides,
            // push the near card further forward and inflate it more), so
            // the vertical gutter has to be proportional to CARD_H rather
            // than a flat py- value, or overflow-hidden clips the top/bottom
            // of that front card. 14% a side covers today's catalog with
            // headroom; a large enough slide count could still outgrow it.
            paddingBlock: isGrid ? undefined : "calc(var(--rc-card-h) * 0.14)",
          }}
        >
          <div
            className={cn(
              isGrid && "columns-2 gap-2 sm:columns-3 lg:columns-4",
            )}
            style={
              isGrid
                ? undefined
                : { position: "relative", height: "var(--rc-card-h)", transformStyle: "preserve-3d" }
            }
          >
            {(isGrid
              ? Array.from({ length: Math.min(GRID_BATCH_SIZE, count) }, (_, slot) => slides[(gridPage * GRID_BATCH_SIZE + slot) % count])
              : slides
            ).map((slide, index) => {
              const actualIndex = isGrid ? gridPage * GRID_BATCH_SIZE + index : index;
              return (
              <div
                key={isGrid ? `flat-slot-${index}` : slide.id}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={slide.title ? `${slide.title}, ${actualIndex + 1} of ${count}` : `${actualIndex + 1} of ${count}`}
                tabIndex={0}
                data-slide-index={actualIndex}
                onClick={(event) => {
                  // Ring mode's selection is handled in endDrag (see its
                  // comment) — a continuously-animating card can't rely on
                  // the browser's native click-target-matching. Grid mode
                  // is static, so the plain click works fine there.
                  if (!isGrid) return;
                  if (movedRef.current) return;
                  onSelect?.(actualIndex, event.currentTarget.getBoundingClientRect());
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(actualIndex, event.currentTarget.getBoundingClientRect());
                  }
                }}
                className={cn(
                  "rotunda-card will-change-transform cursor-pointer overflow-hidden rounded-none border-2 border-line bg-panel shadow-xl outline-none ring-focus focus-visible:ring-2",
                  isGrid ? "rotunda-card--grid relative mb-2 block break-inside-avoid" : "absolute left-1/2 top-1/2",
                )}
                style={
                  isGrid
                    ? undefined
                    : { width: "var(--rc-card-w)", height: "var(--rc-card-h)" }
                }
              >
                {isGrid ? (
                  <FlatArtworkSlot
                    slide={slide}
                    slot={index}
                    allowChange={flatChangeSlots.has(index)}
                    transitionDirection={flatTransitionDirection}
                  />
                ) : (
                  <>
                    <motion.div
                      layoutId={`artwork-image-${slide.id}`}
                      className="h-full w-full"
                    >
                      <FallbackImage
                        src={slide.src}
                        alt={slide.alt}
                        draggable={false}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full select-none object-cover"
                      />
                    </motion.div>
                    {(slide.title || slide.subtitle || slide.price) ? (
                      <div className="rotunda-card__meta">
                        {slide.title ? <strong>{slide.title}</strong> : null}
                        {slide.subtitle ? <span>{slide.subtitle}</span> : null}
                        {slide.price ? <span>{slide.price}</span> : null}
                        <button type="button" className="rotunda-card__purchase">
                          Inquire to purchase
                        </button>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
              );
            })}
          </div>
        </div>

        {!reducedMotion && (
          <>
            <button type="button" onPointerDown={(event) => { event.stopPropagation(); startNavShimmer("previous"); }} onPointerUp={(event) => event.stopPropagation()} onMouseEnter={() => startNavShimmer("previous")} onMouseLeave={() => finishNavShimmer("previous")} onFocus={() => startNavShimmer("previous")} onBlur={() => finishNavShimmer("previous")} onClick={() => rotateByCard(-1)} aria-label="Show previous artwork" className={cn("rotunda-nav rotunda-nav--previous", navVisual?.which === "previous" && `rotunda-nav--${navVisual.phase}`)}>
              <ArrowLeft className="size-5" aria-hidden="true" />
            </button>
            <button type="button" onPointerDown={(event) => { event.stopPropagation(); startNavShimmer("next"); }} onPointerUp={(event) => event.stopPropagation()} onMouseEnter={() => startNavShimmer("next")} onMouseLeave={() => finishNavShimmer("next")} onFocus={() => startNavShimmer("next")} onBlur={() => finishNavShimmer("next")} onClick={() => rotateByCard(1)} aria-label="Show next artwork" className={cn("rotunda-nav rotunda-nav--next", navVisual?.which === "next" && `rotunda-nav--${navVisual.phase}`)}>
              <ArrowRight className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={togglePause}
              aria-label={paused ? "Resume rotation" : "Pause rotation"}
              aria-pressed={manualPaused}
              title={paused ? "Resume artwork rotation" : "Pause artwork rotation"}
              className="rotunda-rotation-control absolute right-0 top-[-5.2rem] z-[200] rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
            >
              {paused ? <ScanLine className="size-5" aria-hidden="true" /> : <Orbit className="size-5" aria-hidden="true" />}
            </button>
          </>
        )}
      </div>

    </div>
  );
}
