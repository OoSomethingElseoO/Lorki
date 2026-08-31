"use client";

import * as React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { SquareArrowOutUpRight } from "lucide-react";
import Link from "next/link";

import { FallbackImage } from "@/components/ui/fallback-image";
import { cn } from "@/lib/utils";

export type CardStackItem = {
  id: string | number;
  title: string;
  description?: string;
  imageSrc?: string;
  href?: string;
  ctaLabel?: string;
  tag?: string;
};

export type CardStackProps<T extends CardStackItem> = {
  items: T[];

  /** Selected index on mount */
  initialIndex?: number;

  /** How many cards are visible around the active (odd recommended) */
  maxVisible?: number;

  /** Card sizing */
  cardWidth?: number;
  cardHeight?: number;

  /** How much cards overlap each other (0..0.8). Higher = more overlap */
  overlap?: number;

  /** Total fan angle (deg). Higher = wider arc */
  spreadDeg?: number;

  /** 3D / depth feel */
  perspectivePx?: number;
  depthPx?: number;
  tiltXDeg?: number;

  /** Active emphasis */
  activeLiftPx?: number;
  activeScale?: number;
  inactiveScale?: number;

  /** Motion */
  springStiffness?: number;
  springDamping?: number;

  /** Behavior */
  loop?: boolean;
  autoAdvance?: boolean;
  intervalMs?: number;
  pauseOnHover?: boolean;

  /** UI */
  showDots?: boolean;
  className?: string;

  /** Hooks */
  onChangeIndex?: (index: number, item: T) => void;

  /**
   * Fired when a card is "selected" for a detail view: clicking the
   * already-active (front) card, since a receded side card's click is
   * spent re-centering the fan instead (see the card's onClick below).
   * Reports the clicked card's real on-screen rect (post-transform, via
   * getBoundingClientRect) so a caller can grow a lightbox from it.
   */
  onSelect?: (index: number, originRect: DOMRect) => void;

  /** Custom renderer (optional) */
  renderCard?: (item: T, state: { active: boolean }) => React.ReactNode;
};

// Below this stage width, the fan switches to a distinct "mobile" mode:
// only the active card + one partial peek on each side (maxOffset 1, so
// 3 cards total) rather than the same maxVisible fan shrunk down to fit.
// Matches the existing `@media (max-width: 720px)` convention used
// elsewhere in app/globals.css for the phone/tablet cutoff.
const MOBILE_BREAKPOINT_PX = 720;
const MOBILE_MAX_VISIBLE = 3;
// Peek fraction of a card's width left showing beyond the active card's
// edge works out to exactly `1 - overlap` (fitScale multiplies both the
// card width and the spacing by the same factor, so it cancels out) —
// 0.82 overlap here gives an ~18% sliver on each side, enough to read as
// "there's more, swipe" without looking like a second full card.
const MOBILE_OVERLAP = 0.82;
// A wide spreadDeg/tiltXDeg is what makes a 7-card desktop fan look like
// a deliberate gallery arc; with only 3 cards on a phone the same tilt
// reads as crooked/glitchy rather than intentional, so mobile mode uses
// a much shallower fan and near-flat 3D tilt instead.
const MOBILE_SPREAD_DEG = 14;
const MOBILE_TILT_X_DEG = 4;

function wrapIndex(n: number, len: number) {
  if (len <= 0) return 0;
  return ((n % len) + len) % len;
}

/** Minimal signed offset from active index to i, with wrapping (for loop behavior). */
function signedOffset(i: number, active: number, len: number, loop: boolean) {
  const raw = i - active;
  if (!loop || len <= 1) return raw;

  // consider wrapped alternative
  const alt = raw > 0 ? raw - len : raw + len;
  return Math.abs(alt) < Math.abs(raw) ? alt : raw;
}

export function CardStack<T extends CardStackItem>({
  items,
  initialIndex = 0,
  maxVisible = 7,

  cardWidth = 520,
  cardHeight = 320,

  overlap = 0.48,
  spreadDeg = 48,

  perspectivePx = 1100,
  depthPx = 140,
  tiltXDeg = 12,

  activeLiftPx = 22,
  activeScale = 1.03,
  inactiveScale = 0.94,

  springStiffness = 280,
  springDamping = 28,

  loop = true,
  autoAdvance = false,
  intervalMs = 2800,
  pauseOnHover = true,

  showDots = true,
  className,

  onChangeIndex,
  onSelect,
  renderCard,
}: CardStackProps<T>) {
  const reduceMotion = useReducedMotion();
  const len = items.length;

  const [active, setActive] = React.useState(() =>
    wrapIndex(initialIndex, len),
  );
  const [hovering, setHovering] = React.useState(false);

  // keep active in bounds if items change
  React.useEffect(() => {
    setActive((a) => wrapIndex(a, len));
  }, [len]);

  React.useEffect(() => {
    if (!len) return;
    onChangeIndex?.(active, items[active]!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // cardWidth/cardSpacing are fixed pixel props with no awareness of the
  // actual container width — at the defaults (520px cards, maxOffset 3),
  // the outermost card's nominal center sits ~810px off-center, needing
  // ~2140px of horizontal room regardless of viewport. Any narrower stage
  // (every real one here) hard-clips the outer cards against the stage's
  // own overflow-hidden edge — confirmed via getBoundingClientRect diffing,
  // outer cards extended ~450px past the clip edge at a 1400px viewport.
  // Measuring the stage's real width and uniformly scaling card size +
  // spacing down to fit (never up past the nominal size) fixes this for
  // any prop combination, the same approach used for the rotunda carousel's
  // analogous large/small-screen spread problem. The same measurement also
  // drives the mobile-mode switch below, rather than adding a second,
  // separate observer just for that.
  const stageRef = React.useRef<HTMLDivElement>(null);
  const [stageWidth, setStageWidth] = React.useState(0);

  React.useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setStageWidth(el.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // stageWidth starts at 0 before the first ResizeObserver callback fires;
  // treat "not yet measured" as desktop so there's no flash of mobile
  // geometry before the real width is known (mirrors fitScale's own
  // `!stageWidth` guard below).
  const isMobileMode = stageWidth > 0 && stageWidth < MOBILE_BREAKPOINT_PX;

  // On mobile this caps at MOBILE_MAX_VISIBLE (3: one active + one peek
  // each side) regardless of what the caller passed — but Math.min still
  // lets a caller ask for fewer than 3, it just can never get more.
  const effectiveMaxVisible = isMobileMode
    ? Math.min(maxVisible, MOBILE_MAX_VISIBLE)
    : maxVisible;
  const effectiveOverlap = isMobileMode ? MOBILE_OVERLAP : overlap;
  const effectiveSpreadDeg = isMobileMode ? MOBILE_SPREAD_DEG : spreadDeg;
  const effectiveTiltXDeg = isMobileMode ? MOBILE_TILT_X_DEG : tiltXDeg;

  const maxOffset = Math.max(0, Math.floor(effectiveMaxVisible / 2));

  const cardSpacing = Math.max(
    10,
    Math.round(cardWidth * (1 - effectiveOverlap)),
  );
  const stepDeg = maxOffset > 0 ? effectiveSpreadDeg / maxOffset : 0;

  const fitScale = React.useMemo(() => {
    if (!stageWidth || maxOffset === 0) return 1;
    const margin = 24; // breathing room off the clip edge
    const availableHalf = Math.max(0, stageWidth / 2 - margin);
    const nominalHalfSpread = maxOffset * cardSpacing + cardWidth / 2;
    if (nominalHalfSpread <= 0) return 1;
    return Math.min(1, availableHalf / nominalHalfSpread);
  }, [stageWidth, maxOffset, cardSpacing, cardWidth]);

  const effectiveCardWidth = cardWidth * fitScale;
  const effectiveCardHeight = cardHeight * fitScale;
  const effectiveSpacing = cardSpacing * fitScale;

  // Cards anchor at `bottom: 0` of the perspective wrapper (the wrapper's
  // padding box, since it's the nearest positioned ancestor) — that anchor
  // point sits exactly on the stage's own overflow-hidden clip edge. A
  // rotateZ fan angle mixes cardWidth into a card's on-screen vertical
  // footprint (a wide, short card rotated diagonally reads much taller
  // than cardHeight), and the downward "arc" offset pushes receded cards
  // further still — so outer cards' real bounding boxes extend well past
  // both the stage's top AND bottom edges. Simply growing the stage's
  // `height` cannot fix the bottom overflow: since the anchor IS the clip
  // edge, more height only buys room above the anchor, never below it.
  // The real fix is two-part: reserve a bottom buffer (via padding-bottom
  // on the wrapper, which shifts the bottom:0 anchor up off the true clip
  // edge) sized to the worst-case downward bulge, and size the stage's
  // total height to the worst-case upward reach plus that buffer.
  const stageMetrics = React.useMemo(() => {
    let minTop = 0;
    let maxBottom = 0;

    for (let abs = 0; abs <= maxOffset; abs++) {
      const isActiveCard = abs === 0;
      const scale = isActiveCard ? activeScale : inactiveScale;
      const rotateZdeg = abs * stepDeg;
      const rotateXdeg = isActiveCard ? 0 : effectiveTiltXDeg;
      const rad = (rotateZdeg * Math.PI) / 180;

      // rotateZ mixes width into the vertical AABB extent of a rotated
      // rectangle: h*|cos| + w*|sin|. rotateX's perspective-projected
      // contribution isn't a clean closed form (it depends on the
      // perspective depth too), so it's approximated as a modest
      // widening rather than modeled exactly — cheap, and errs toward
      // extra headroom rather than under-sizing.
      const tiltFactor = 1 + Math.sin((rotateXdeg * Math.PI) / 180) * 0.35;
      const bboxHeight =
        scale *
        tiltFactor *
        (effectiveCardHeight * Math.abs(Math.cos(rad)) + effectiveCardWidth * Math.abs(Math.sin(rad)));

      const arcY = abs * 10; // matches the arc-down offset used below
      const lift = isActiveCard ? -activeLiftPx : 0;
      const centerY = -effectiveCardHeight / 2 + arcY + lift; // relative to the bottom:0 anchor
      const halfBox = bboxHeight / 2;

      minTop = Math.min(minTop, centerY - halfBox);
      maxBottom = Math.max(maxBottom, centerY + halfBox);
    }

    const buffer = 20; // rounding / sub-pixel slack
    const bottomPad = Math.max(0, maxBottom) + buffer;
    const height = Math.max(380, effectiveCardHeight + 80, -minTop + bottomPad + buffer);
    return { height, bottomPad };
  }, [
    maxOffset,
    stepDeg,
    effectiveCardWidth,
    effectiveCardHeight,
    activeScale,
    inactiveScale,
    effectiveTiltXDeg,
    activeLiftPx,
  ]);

  const canGoPrev = loop || active > 0;
  const canGoNext = loop || active < len - 1;

  const prev = React.useCallback(() => {
    if (!len) return;
    if (!canGoPrev) return;
    setActive((a) => wrapIndex(a - 1, len));
  }, [canGoPrev, len]);

  const next = React.useCallback(() => {
    if (!len) return;
    if (!canGoNext) return;
    setActive((a) => wrapIndex(a + 1, len));
  }, [canGoNext, len]);

  // keyboard navigation (when container focused)
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") prev();
    if (e.key === "ArrowRight") next();
  };

  // autoplay
  React.useEffect(() => {
    if (!autoAdvance) return;
    if (reduceMotion) return;
    if (!len) return;
    if (pauseOnHover && hovering) return;

    const id = window.setInterval(
      () => {
        if (loop || active < len - 1) next();
      },
      Math.max(700, intervalMs),
    );

    return () => window.clearInterval(id);
  }, [
    autoAdvance,
    intervalMs,
    hovering,
    pauseOnHover,
    reduceMotion,
    len,
    loop,
    active,
    next,
  ]);

  if (!len) return null;

  const activeItem = items[active]!;

  return (
    <div
      className={cn("w-full", className)}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Stage */}
      <div
        ref={stageRef}
        // Fanned-out cards sit at x = offset * effectiveSpacing, scaled by
        // fitScale above to fit this stage's own measured width — without
        // that, outer cards would extend well past the container and get
        // hard-clipped by overflow-hidden below (confirmed: ~450px past the
        // clip edge at 1400px wide, using the nominal unscaled spacing).
        // overflow-hidden itself still matters even with fitScale in place
        // (mid-transition drag/spring overshoot, a future prop combination,
        // etc.) — without it, any overflow inflates the whole page's
        // scrollable width and the entire site scrolls sideways.
        className="relative w-full overflow-hidden"
        style={{ height: stageMetrics.height }}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        {/* background wash / spotlight (unique feel) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-6 mx-auto h-48 w-[70%] rounded-full bg-ink/5 blur-3xl dark:bg-light/5"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 mx-auto h-40 w-[76%] rounded-full bg-ink/10 blur-3xl dark:bg-black/30"
          aria-hidden="true"
        />

        <div
          className="absolute inset-0 flex items-end justify-center"
          style={{
            perspective: `${perspectivePx}px`,
          }}
        >
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const off = signedOffset(i, active, len, loop);
              const abs = Math.abs(off);
              const visible = abs <= maxOffset;

              // hide far-away cards cleanly
              if (!visible) return null;

              // fan geometry
              const rotateZ = off * stepDeg;
              const x = off * effectiveSpacing;
              const y = abs * 10; // subtle arc-down feel
              const z = -abs * depthPx;

              const isActive = off === 0;

              const scale = isActive ? activeScale : inactiveScale;
              const lift = isActive ? -activeLiftPx : 0;

              const rotateX = isActive ? 0 : effectiveTiltXDeg;

              const zIndex = 100 - abs;

              // drag only on the active card
              const dragProps = isActive
                ? {
                    drag: "x" as const,
                    dragConstraints: { left: 0, right: 0 },
                    dragElastic: 0.18,
                    onDragEnd: (
                      _e: unknown,
                      info: { offset: { x: number }; velocity: { x: number } },
                    ) => {
                      if (reduceMotion) return;
                      const travel = info.offset.x;
                      const v = info.velocity.x;
                      const threshold = Math.min(160, effectiveCardWidth * 0.22);

                      // swipe logic
                      if (travel > threshold || v > 650) prev();
                      else if (travel < -threshold || v < -650) next();
                    },
                  }
                : {};

              return (
                <motion.div
                  key={item.id}
                  className={cn(
                    "absolute rounded-none border-2 border-line overflow-hidden shadow-xl",
                    "will-change-transform select-none",
                    isActive
                      ? "cursor-grab active:cursor-grabbing"
                      : "cursor-pointer",
                  )}
                  style={{
                    width: effectiveCardWidth,
                    height: effectiveCardHeight,
                    // Not `bottom: 0` — that anchors the card's unrotated
                    // box flush to the stage's own overflow-hidden clip
                    // edge, so any downward bulge (fan rotation + arc
                    // offset) has nowhere to go but clipped. Anchoring
                    // `stageMetrics.bottomPad` above that edge instead
                    // reserves exactly the room the worst-case card needs.
                    bottom: stageMetrics.bottomPad,
                    zIndex,
                    transformStyle: "preserve-3d",
                  }}
                  initial={
                    reduceMotion
                      ? false
                      : {
                          opacity: 0,
                          y: y + 40,
                          x,
                          rotateZ,
                          rotateX,
                          scale,
                        }
                  }
                  animate={{
                    opacity: 1,
                    x,
                    y: y + lift,
                    rotateZ,
                    rotateX,
                    // framer doesn't support translateZ directly in animate on all setups,
                    // so we use a custom transform via style below.
                    scale,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: springStiffness,
                    damping: springDamping,
                  }}
                  // translateZ via style transform (kept stable w/ motion values above)
                  // We apply translateZ by using a CSS transform in a child wrapper.
                  //
                  // The front card is already focused, so its own click means
                  // "open the detail view"; a receded side card's click still
                  // means "bring it to front" first — a second click (now
                  // active) is what opens it. Cards here aren't continuously
                  // animating (no autoplay by default), so a plain click event
                  // and a plain getBoundingClientRect() are both reliable —
                  // unlike RotundaCarousel, no elementFromPoint workaround
                  // needed.
                  onClick={(event) => {
                    if (isActive) {
                      onSelect?.(i, event.currentTarget.getBoundingClientRect());
                    } else {
                      setActive(i);
                    }
                  }}
                  {...dragProps}
                >
                  <div
                    className="h-full w-full"
                    style={{
                      transform: `translateZ(${z}px)`,
                      transformStyle: "preserve-3d",
                    }}
                  >
                    {renderCard ? (
                      renderCard(item, { active: isActive })
                    ) : (
                      <DefaultFanCard item={item} active={isActive} />
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Dots navigation centered at bottom */}
      {showDots ? (
        <div className="mt-6 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            {items.map((it, idx) => {
              const on = idx === active;
              return (
                <button
                  key={it.id}
                  onClick={() => setActive(idx)}
                  className={cn(
                    "h-2 w-2 rounded-full transition",
                    on ? "bg-ink" : "bg-ink/30 hover:bg-ink/50",
                  )}
                  aria-label={`Go to ${it.title}`}
                />
              );
            })}
          </div>
          {activeItem.href ? (
            <Link
              href={activeItem.href}
              className="text-muted transition hover:text-ink"
              aria-label="Open link"
            >
              <SquareArrowOutUpRight className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function DefaultFanCard({ item }: { item: CardStackItem; active: boolean }) {
  return (
    <div className="relative h-full w-full">
      {/* image */}
      <div className="absolute inset-0">
        {item.imageSrc ? (
          <FallbackImage
            src={item.imageSrc}
            alt={item.title}
            className="h-full w-full object-cover"
            draggable={false}
            loading="eager"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel text-sm text-muted">
            No image
          </div>
        )}
      </div>

      {/* subtle gradient overlay at bottom for text readability */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

      {/* content */}
      <div className="relative z-10 flex h-full flex-col justify-end p-5">
        <div className="truncate font-[family-name:var(--font-display)] text-lg font-semibold text-light">
          {item.title}
        </div>
        {item.description ? (
          <div className="mt-1 line-clamp-2 text-sm text-light/80">
            {item.description}
          </div>
        ) : null}
      </div>
    </div>
  );
}
