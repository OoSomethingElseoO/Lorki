"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger);

/**
 * Scroll-velocity skew. Any element tagged [data-skew] shears on the Y
 * axis in proportion to scroll speed, then springs back to flat when
 * scrolling stops. Mounted once near the root (see app/layout.tsx) — bails
 * before touching ScrollTrigger when a page has zero [data-skew]
 * elements, so it's cheap everywhere else in the app. Re-binds on route
 * change so newly mounted elements on the next page are covered.
 *
 * Disabled below 860px (this app's hero stacking breakpoint) and under
 * prefers-reduced-motion — a heavy shear on a narrow column reads badly
 * and can make text genuinely hard to read.
 */
export function KineticSkew() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(max-width: 860px)").matches) return;

    const targets = gsap.utils.toArray<HTMLElement>("[data-skew]");
    if (!targets.length) return;

    const setters = targets.map((t) => {
      gsap.set(t, { transformOrigin: "right center", force3D: true });
      return gsap.quickSetter(t, "skewY", "deg");
    });

    const clamp = gsap.utils.clamp(-4, 4);
    const proxy = { skew: 0 };

    const st = ScrollTrigger.create({
      onUpdate: (self) => {
        const skew = clamp(self.getVelocity() / -600);
        if (Math.abs(skew) > Math.abs(proxy.skew)) {
          proxy.skew = skew;
          gsap.to(proxy, {
            skew: 0,
            duration: 0.8,
            ease: "power3",
            overwrite: true,
            onUpdate: () => setters.forEach((set) => set(proxy.skew)),
          });
        }
      },
    });

    return () => {
      st.kill();
      setters.forEach((set) => set(0));
    };
  }, [pathname]);

  return null;
}
