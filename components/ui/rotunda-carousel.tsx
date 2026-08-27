"use client";

import * as React from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Flip } from "gsap/Flip";
import { Pause, Play } from "lucide-react";

import { cn } from "@/lib/utils";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, Flip);
}

const useIsoLayoutEffect =
  typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export type RotundaSlide = {
  id: string;
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
};

export type RotundaCarouselProps = {
  slides: RotundaSlide[];
  onSelect?: (index: number, originRect: DOMRect) => void;
  /** Ambient rotation speed, degrees per second. */
  speed?: number;
  /** Names the carousel for assistive tech. */
  label?: string;
  className?: string;
};

// Everything else (radius, perspective) is derived from these, so the whole
// rig scales together instead of one dimension outrunning the other.
const CARD_W = "clamp(150px, 16vw, 240px)";
const CARD_H = "clamp(190px, 20vw, 300px)";

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
  const hoverPausedRef = React.useRef(false);
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
  const [hoverPaused, setHoverPaused] = React.useState(false);
  const [manualPaused, setManualPaused] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const paused = hoverPaused || manualPaused;

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
      setActiveIndex(nearest);
    }
  }, [count]);

  const playAmbient = React.useCallback(() => {
    if (reducedMotion) return;
    if (isGridRef.current) return;
    if (hoverPausedRef.current || manualPausedRef.current) return;
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
  // pause/resume path (hover, IO, drag, Flip) just calls playAmbient again.
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

  // Card width drives the ring radius, so remeasure whenever the box
  // actually changes and repaint the (possibly-paused) frame either way.
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
      radiusRef.current = denom ? widthRef.current / 2 / denom : 0;
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
        if (isGridRef.current || hoverPausedRef.current || manualPausedRef.current) return;
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

  // Pause (hover or the explicit control) morphs the ring into a flat grid
  // via Flip; unpausing morphs it back and hands off to the ambient tween.
  //
  // This used to capture Flip.getState() and flip `isGrid` inside the same
  // synchronous flushSync() call, right here in a passive effect. React
  // throws "flushSync was called from inside a lifecycle method" for that —
  // a regular useEffect still counts as a lifecycle method as far as
  // flushSync is concerned, even though it runs after commit. The fix is
  // the standard two-phase pattern: capture the "before" Flip state and
  // request the isGrid change normally here (no flushSync), then run
  // Flip.from() in a separate useLayoutEffect keyed on `isGrid` — that
  // fires synchronously right after the new layout commits but before the
  // browser paints, which is exactly when Flip needs to run.
  const pendingFlipRef = React.useRef<{ state: ReturnType<typeof Flip.getState>; toGrid: boolean } | null>(null);

  React.useEffect(() => {
    if (!didMountFlipRef.current) {
      didMountFlipRef.current = true;
      return;
    }
    if (reducedMotion || !count) return;

    const cards = cardRefs.current.filter((c): c is HTMLDivElement => !!c);
    if (!cards.length) return;

    if (paused) {
      ambientTweenRef.current?.kill();
      inertiaTweenRef.current?.kill();
    }

    pendingFlipRef.current = { state: Flip.getState(cards), toGrid: paused };
    isGridRef.current = paused;
    setIsGrid(paused);
  }, [paused, reducedMotion, count]);

  useIsoLayoutEffect(() => {
    const pending = pendingFlipRef.current;
    if (!pending) return;
    pendingFlipRef.current = null;

    const cards = cardRefs.current.filter((c): c is HTMLDivElement => !!c);
    if (!cards.length) return;

    if (pending.toGrid) {
      cards.forEach((c) => {
        c.style.transform = "";
        c.style.opacity = "";
        c.style.zIndex = "";
      });
    } else {
      // Paint the ring targets immediately so Flip has somewhere real to
      // fly to, instead of everything converging on the centre first.
      paint();
    }

    Flip.from(pending.state, {
      duration: 0.6,
      ease: "power2.inOut",
      absolute: true,
      stagger: 0.02,
      onComplete: () => {
        if (pending.toGrid) {
          cards.forEach((c) => {
            c.style.transform = "";
            c.style.opacity = "";
            c.style.zIndex = "";
          });
        } else {
          paint();
          playAmbient();
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGrid]);

  const onMouseEnter = () => {
    if (reducedMotion) return;
    hoverPausedRef.current = true;
    setHoverPaused(true);
  };

  const onMouseLeave = () => {
    if (reducedMotion) return;
    hoverPausedRef.current = false;
    setHoverPaused(false);
  };

  const togglePause = () => {
    if (reducedMotion) return;
    const next = !manualPausedRef.current;
    manualPausedRef.current = next;
    setManualPaused(next);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isGridRef.current || reducedMotion || !count) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    ambientTweenRef.current?.kill();
    ambientTweenRef.current = null;
    inertiaTweenRef.current?.kill();
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
    if (Math.abs(dx) > 4) movedRef.current = true;

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
    },
    [],
  );

  if (count === 0) return null;

  const active = slides[activeIndex];

  return (
    <div
      className={cn("w-full", className)}
      style={{ ["--rc-card-w" as string]: CARD_W, ["--rc-card-h" as string]: CARD_H }}
      role="region"
      aria-label={label}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="relative">
        <div
          ref={frameRef}
          tabIndex={-1}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className={cn(
            "outline-none",
            // Ring-mode cards are pushed out via translateZ/rotateY well
            // past the frame's own box — without clipping that, they
            // inflate the page's scrollable width and the whole site
            // scrolls sideways. Grid mode has nothing to clip.
            !isGrid && "cursor-grab select-none overflow-hidden py-10 active:cursor-grabbing",
          )}
          style={{
            perspective: isGrid ? undefined : `calc(var(--rc-card-w) * 3)`,
            touchAction: isGrid ? undefined : "pan-y",
          }}
        >
          <div
            className={cn(
              isGrid &&
                "grid grid-cols-[repeat(auto-fill,minmax(var(--rc-card-w),1fr))] gap-6",
            )}
            style={
              isGrid
                ? undefined
                : { position: "relative", height: "var(--rc-card-h)", transformStyle: "preserve-3d" }
            }
          >
            {slides.map((slide, index) => (
              <div
                key={slide.id}
                ref={(node) => {
                  cardRefs.current[index] = node;
                }}
                role="group"
                aria-roledescription="slide"
                aria-label={slide.title ? `${slide.title}, ${index + 1} of ${count}` : `${index + 1} of ${count}`}
                tabIndex={0}
                onClick={(event) => {
                  if (movedRef.current) return;
                  onSelect?.(index, event.currentTarget.getBoundingClientRect());
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect?.(index, event.currentTarget.getBoundingClientRect());
                  }
                }}
                className={cn(
                  "will-change-transform cursor-pointer overflow-hidden rounded-none border-2 border-line bg-panel shadow-xl outline-none ring-focus focus-visible:ring-2",
                  isGrid ? "relative flex flex-col" : "absolute left-1/2 top-1/2",
                )}
                style={
                  isGrid
                    ? undefined
                    : { width: "var(--rc-card-w)", height: "var(--rc-card-h)" }
                }
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className={cn(
                    "select-none object-cover",
                    isGrid ? "aspect-[3/4] w-full" : "h-full w-full",
                  )}
                />
                {isGrid && (slide.title || slide.subtitle) && (
                  <div className="flex flex-col items-start gap-0.5 border-t-2 border-line bg-panel/80 px-3 py-2">
                    {slide.title && (
                      <p className="font-[family-name:var(--font-display)] text-[13px] font-semibold tracking-tight text-ink">
                        {slide.title}
                      </p>
                    )}
                    {slide.subtitle && (
                      <p className="text-[12px] text-muted">{slide.subtitle}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {!reducedMotion && (
          <button
            type="button"
            onClick={togglePause}
            aria-label={paused ? "Resume rotation" : "Pause rotation"}
            aria-pressed={manualPaused}
            className="absolute right-3 top-3 z-[200] rounded-none border-2 border-line bg-panel/80 p-2 text-ink backdrop-blur transition hover:bg-panel focus-visible:outline-none focus-visible:ring-2 ring-focus"
          >
            {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
        )}
      </div>

      {!isGrid && active?.title && (
        <div
          key={activeIndex}
          className="mt-2 flex flex-col items-center px-6"
        >
          <p className="font-[family-name:var(--font-display)] text-[15px] font-semibold tracking-tight text-ink">
            {active.title}
          </p>
          {active.subtitle && (
            <p className="mt-1 text-[13px] text-muted">{active.subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
