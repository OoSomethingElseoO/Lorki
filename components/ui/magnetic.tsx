"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { gsap } from "gsap";

type MagneticProps = {
  children: ReactNode;
  /** How far the child travels relative to cursor offset from center. */
  strength?: number;
  className?: string;
};

/**
 * Wraps a child element and gives it a small magnetic pull toward the
 * cursor on hover, springing back to rest on mouse-leave. Purely a
 * transform on this wrapper div — it never touches the child's own click
 * or href handling, so a real <Link>/<button> inside stays fully
 * functional.
 */
export function Magnetic({ children, strength = 0.35, className }: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const onMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || reducedMotionRef.current) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (event.clientX - (left + width / 2)) * strength;
    const y = (event.clientY - (top + height / 2)) * strength;
    gsap.to(el, { x, y, duration: 0.6, ease: "power3.out" });
  };

  const onLeave = () => {
    if (!ref.current || reducedMotionRef.current) return;
    gsap.to(ref.current, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className ? `inline-block will-change-transform ${className}` : "inline-block will-change-transform"}
    >
      {children}
    </div>
  );
}
