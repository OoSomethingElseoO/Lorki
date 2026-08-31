"use client";

import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useRef, type ReactNode } from "react";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText, ScrollTrigger, useGSAP);

export type TextBlockAnimationProps = {
  /** Must be a single element (e.g. a heading) — SplitText targets it directly. */
  children: ReactNode;
  animateOnScroll?: boolean;
  delay?: number;
  /** The revealer block's color — pass a real hex/CSS color value, not a token name. */
  blockColor?: string;
  stagger?: number;
  duration?: number;
};

// Each line gets wrapped in an overflow-hidden box with an opaque block
// sitting on top; the block sweeps left→right (hiding the line), the line
// snaps to visible underneath it, then the block sweeps on off the right
// edge — reads as the text being "unveiled" by a moving panel rather than
// a plain fade/slide. Deliberately imperative DOM (creating wrapper/block
// elements directly) instead of a second layer of React state, matching
// the reference implementation this was adapted from.
//
// SplitText must target the actual heading element, not a wrapper
// containing it — its line detection recurses into nested block children
// and clones them when their content needs to span multiple visual lines,
// so pointing it at a wrapper div around a heading made it clone the
// heading itself once per line, producing multiple elements sharing the
// same id/class (a real bug, found and fixed earlier). The obvious way to
// get a ref onto the caller's own single child — Children.only +
// cloneElement, synchronously inspecting the raw `children` prop's object
// shape — turned out to be fragile in a different way: when a Server
// Component (e.g. a page.tsx with no "use client") passes JSX straight
// into this Client Component, React serializes that children value as a
// special RSC "lazy" wrapper object crossing the boundary, and in dev mode
// that wrapper isn't resolved into a plain element yet by the time
// Children.only/isValidElement synchronously inspect it — so it throws
// "expected to receive a single React element child" even though exactly
// one element is genuinely being passed (confirmed via debug logging: the
// same component works fine when the caller is itself a client component,
// e.g. Hero, since no server/client handoff is involved there). Fixed by
// not introspecting `children`'s shape at all: render it normally inside a
// wrapper <div>, then reach into the DOM for the one real child element
// once React has fully resolved everything — after render, not during it.
export function TextBlockAnimation({
  children,
  animateOnScroll = true,
  delay = 0,
  blockColor = "#000",
  stagger = 0.1,
  duration = 0.6,
}: TextBlockAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const target = containerRef.current?.firstElementChild as HTMLElement | null | undefined;
      if (!target) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // lines/blocks live outside the try so the catch below can still
      // force-reveal whatever partial DOM surgery happened before a throw.
      let lines: Element[] = [];
      const blocks: HTMLDivElement[] = [];

      try {
        const split = SplitText.create(target, {
          type: "lines",
          linesClass: "block-line-parent",
        });
        lines = split.lines;

        // Hard-revealed end state, reused below both as the timeline's own
        // guaranteed landing spot and as a last-resort fallback — nothing
        // downstream of this point may leave a line's real text depending
        // on every earlier tween in the chain having fired cleanly.
        const forceRevealed = () => {
          gsap.set(blocks, { scaleX: 0 });
          gsap.set(lines, { opacity: 1 });
        };

        lines.forEach((line) => {
          const wrapper = document.createElement("div");
          wrapper.style.position = "relative";
          wrapper.style.display = "block";
          wrapper.style.overflow = "hidden";

          const block = document.createElement("div");
          block.style.position = "absolute";
          block.style.top = "0";
          block.style.left = "0";
          block.style.width = "100%";
          block.style.height = "100%";
          block.style.backgroundColor = blockColor;
          block.style.zIndex = "2";
          block.style.transform = "scaleX(0)";
          block.style.transformOrigin = "left center";

          line.parentNode?.insertBefore(wrapper, line);
          wrapper.appendChild(line);
          wrapper.appendChild(block);

          gsap.set(line, { opacity: 0 });
          blocks.push(block);
        });

        const tl = gsap.timeline({
          defaults: { ease: "expo.inOut" },
          scrollTrigger: animateOnScroll
            ? {
                trigger: containerRef.current,
                start: "top 85%",
                toggleActions: "play none none reverse",
              }
            : undefined,
          delay,
          // Belt-and-suspenders, not a fix for a confirmed cause: under
          // heavy CPU throttling we saw the reveal legitimately still
          // mid-sweep several seconds in (self-resolving once the tab
          // caught up, never actually stuck), but nothing in the chain
          // guaranteed a correct landing spot if a tween were ever
          // skipped/interrupted instead of just delayed. onComplete covers
          // the timeline finishing with some intermediate step having
          // failed to apply; onInterrupt covers tl.kill() firing from
          // anywhere other than this component's own unmount cleanup below
          // (which already does a full split.revert()).
          onComplete: forceRevealed,
          onInterrupt: forceRevealed,
        });

        tl.to(blocks, {
          scaleX: 1,
          duration,
          stagger,
          transformOrigin: "left center",
        })
          .set(
            lines,
            { opacity: 1, stagger },
            `<${duration / 2}`,
          )
          .to(
            blocks,
            {
              scaleX: 0,
              duration,
              stagger,
              transformOrigin: "right center",
            },
            `<${duration * 0.4}`,
          );

        return () => {
          tl.kill();
          // Undo the manual wrapper/block DOM surgery FIRST, restoring each
          // line to exactly where SplitText originally put it, before
          // calling split.revert() — revert() only knows how to undo
          // SplitText's own line-wrapping, not the extra wrapper+block
          // elements layered on top of it here.
          lines.forEach((line) => {
            const wrapper = line.parentElement;
            if (wrapper?.parentElement) {
              wrapper.parentElement.insertBefore(line, wrapper);
              wrapper.remove();
            }
          });
          split.revert();
        };
      } catch (err) {
        // SplitText/timeline setup itself throwing partway through (as
        // opposed to a tween misbehaving, handled above) can leave some
        // lines already sitting at opacity:0 with no timeline left to ever
        // reveal them — force whatever got split back to visible rather
        // than permanently blanking the real headline copy.
        gsap.set(lines, { opacity: 1 });
        console.error("TextBlockAnimation setup failed; showing plain text", err);
        return undefined;
      }
    },
    { scope: containerRef, dependencies: [animateOnScroll, delay, blockColor, stagger, duration] },
  );

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {children}
    </div>
  );
}
