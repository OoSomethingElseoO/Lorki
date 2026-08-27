"use client";

import * as React from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

if (typeof window !== "undefined") gsap.registerPlugin(useGSAP);

export type PrintRackItem = {
  id: string;
};

export type PrintRackProps<T extends PrintRackItem> = {
  items: T[];
  /** Renders one tile's contents — image/price/CTA. The rack owns layout,
      scroll, and motion; the caller only owns what's inside a tile. */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Names the scroll region for assistive tech. */
  label?: string;
  className?: string;
};

// A flat horizontal shelf you glide along — deliberately not another 3D
// rig. The rotunda (Originals) spins a ring in rotateY/translateZ space,
// the fan (Artists) stacks layered cards you click through one at a time;
// this is neither: real, native horizontal scrolling (touch/trackpad/drag
// all just work, nothing hijacks them) with GSAP layered on top only for
// the parts a plain <div style="overflow-x:auto"> can't do on its own —
// smooth arrow-button paging and a "lift" that makes whichever tile is
// nearest the viewport's centre (the one a shopper is actually looking at)
// float up slightly, like pulling a print forward off a shelf to look at
// it. That distinguishes "browsing a shop shelf" from "watching a carousel
// play."
export function PrintRack<T extends PrintRackItem>({ items, renderItem, label = "Prints", className }: PrintRackProps<T>) {
  const trackRef = React.useRef<HTMLDivElement>(null);
  const tileRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const thumbRef = React.useRef<HTMLDivElement>(null);

  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [atStart, setAtStart] = React.useState(true);
  const [atEnd, setAtEnd] = React.useState(true);

  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReducedMotion(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useGSAP(
    () => {
      const track = trackRef.current;
      if (!track) return;

      const tiles = tileRefs.current.filter((tile): tile is HTMLDivElement => Boolean(tile));
      const liftSetters = tiles.map((tile) => ({
        scale: gsap.quickTo(tile, "scale", { duration: 0.35, ease: "power2.out" }),
        y: gsap.quickTo(tile, "y", { duration: 0.35, ease: "power2.out" }),
      }));

      const update = () => {
        const trackRect = track.getBoundingClientRect();
        const centerX = trackRect.left + trackRect.width / 2;

        tiles.forEach((tile, index) => {
          const setter = liftSetters[index];
          if (!setter) return;
          if (reducedMotion) {
            setter.scale(1);
            setter.y(0);
            return;
          }
          const tileRect = tile.getBoundingClientRect();
          const tileCenter = tileRect.left + tileRect.width / 2;
          const distance = Math.abs(centerX - tileCenter);
          // 1 right at centre, fading to 0 by roughly one tile-width out —
          // so only the tile(s) actually near the middle of the viewport
          // lift, not the whole row at once.
          const proximity = gsap.utils.clamp(0, 1, 1 - distance / (tileRect.width * 0.9 || 1));
          setter.scale(1 + proximity * 0.05);
          setter.y(-proximity * 8);
        });

        const max = track.scrollWidth - track.clientWidth;
        setAtStart(track.scrollLeft <= 2);
        setAtEnd(track.scrollLeft >= max - 2);

        if (thumbRef.current && max > 0) {
          const visibleFraction = gsap.utils.clamp(0.12, 1, track.clientWidth / track.scrollWidth);
          const travel = 100 - visibleFraction * 100;
          const scrolled = gsap.utils.clamp(0, 1, track.scrollLeft / max);
          gsap.set(thumbRef.current, { width: `${visibleFraction * 100}%`, x: `${travel * scrolled}%` });
        } else if (thumbRef.current) {
          gsap.set(thumbRef.current, { width: "100%", x: "0%" });
        }
      };

      update();
      track.addEventListener("scroll", update, { passive: true });
      const resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(track);
      window.addEventListener("resize", update);

      return () => {
        track.removeEventListener("scroll", update);
        resizeObserver.disconnect();
        window.removeEventListener("resize", update);
      };
    },
    { scope: trackRef, dependencies: [items.length, reducedMotion] },
  );

  const scrollByStep = React.useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstTile = tileRefs.current.find((tile): tile is HTMLDivElement => Boolean(tile));
    const step = firstTile ? firstTile.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
    const max = track.scrollWidth - track.clientWidth;
    const target = gsap.utils.clamp(0, Math.max(0, max), track.scrollLeft + direction * step);
    gsap.to(track, { scrollLeft: target, duration: 0.55, ease: "power2.out", overwrite: "auto" });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className={cn("prints-rack", className)}>
      <div className="prints-rack__viewport">
        <div
          ref={trackRef}
          className="prints-rack__track"
          role="list"
          aria-label={label}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") {
              event.preventDefault();
              scrollByStep(1);
            } else if (event.key === "ArrowLeft") {
              event.preventDefault();
              scrollByStep(-1);
            }
          }}
        >
          {items.map((item, index) => (
            <div
              key={item.id}
              ref={(node) => {
                tileRefs.current[index] = node;
              }}
              role="listitem"
              className={cn("prints-rack__tile", index % 2 === 1 && "prints-rack__tile--lean-right")}
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      </div>

      {items.length > 1 && (
        <div className="prints-rack__controls">
          <button
            type="button"
            className="prints-rack__nav"
            onClick={() => scrollByStep(-1)}
            disabled={atStart}
            aria-label="Scroll prints left"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <div className="prints-rack__progress" aria-hidden="true">
            <div ref={thumbRef} className="prints-rack__progress-thumb" />
          </div>
          <button
            type="button"
            className="prints-rack__nav"
            onClick={() => scrollByStep(1)}
            disabled={atEnd}
            aria-label="Scroll prints right"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
