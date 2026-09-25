"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { FallbackImage } from "@/components/ui/fallback-image";
import { HeroHeadline } from "@/components/hero-headline";

export type HeroImage = { src: string; alt: string; artistName?: string };

/** Admin-managed final words. The sentence prefixes stay fixed so every
 * combination remains grammatical while the artwork campaign can evolve. */
export type HeroHeadlineWords = {
  first: string[];
  second: string[];
  third: string[];
};

type HeroProps = {
  eyebrow: string;
  /** The big catchy headline — was previously the site name, redundant with
      the header wordmark directly above it. Now a real hook. */
  headline: string;
  /** Optional dynamic nouns supplied by the admin settings backend. */
  headlineWords?: HeroHeadlineWords;
  /** A short supporting line — the "how it works" in one sentence. */
  subline: string;
  /**
   * One entry: shown statically (this is always the case when an admin has
   * set settings.heroImageUrl, or when there's only a single fallback
   * image). Multiple entries: crossfades slowly through them — only used
   * when there's no admin override, cycling through live inventory.
   */
  images: HeroImage[];
};

export function Hero({ eyebrow, headline, headlineWords, subline, images }: HeroProps) {
  const fadeRef = useRef<HTMLDivElement>(null);
  const words = headlineWords ?? {
    first: ["art"],
    second: ["masterpieces"],
    third: ["wildlife"],
  };
  const accessibleHeadline = `Sell ${words.first[0] ?? "art"}. Own ${words.second[0] ?? "masterpieces"}. Protect ${words.third[0] ?? "wildlife"}.`;

  // The headline's own reveal is TextBlockAnimation (below) — this timeline
  // only handles the eyebrow/subline/CTAs fade-up, timed to start partway
  // through the headline's block-reveal rather than waiting for it to fully
  // finish, so the two don't read as two separate, disconnected beats.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!fadeRef.current) return;

    const tl = gsap.timeline({ delay: 0.9 });
    // Keep the copy visible if GSAP cannot initialise (for example during a
    // reduced-motion/browser startup race). The old `from` call applied
    // opacity: 0 immediately, which could leave the eyebrow, tagline, and
    // actions permanently invisible while the headline remained visible.
    tl.from(".hero__fade", {
      y: 22,
      opacity: 0,
      duration: 0.7,
      ease: "power3.out",
      stagger: 0.08,
      immediateRender: false,
    });

    return () => {
      tl.kill();
    };
  }, [headline]);

  return (
    <section className="hero" aria-labelledby="home-title">
      <div className="hero__copy" data-skew ref={fadeRef}>
        <HeroHeadline words={words} ariaLabel={accessibleHeadline} />
        <p className="hero__tagline hero__fade">{subline}</p>
      </div>
      <div className="hero__frame">
        <HeroArtwork images={images} />
      </div>
    </section>
  );
}

function HeroArtwork({ images }: { images: HeroImage[] }) {
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const labelRef = useRef<HTMLSpanElement>(null);
  const activeRef = useRef(0);

  // Slow crossfade through a handful of live pieces — only runs at all
  // when there's more than one image (i.e. no admin override) and motion
  // isn't reduced. Deliberately imperative/ref-driven rather than React
  // state: letting GSAP fully own each <img>'s opacity means a re-render
  // mid-fade can never stomp on an in-flight tween's interpolated value.
  // The artist-name label swaps in lockstep with the image, on the same
  // ref-driven/imperative basis, not React state.
  useEffect(() => {
    if (labelRef.current) labelRef.current.textContent = images[0]?.artistName ?? "";

    if (images.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = window.setInterval(() => {
      const prev = activeRef.current;
      const next = (prev + 1) % images.length;
      activeRef.current = next;

      const fromEl = imgRefs.current[prev];
      const toEl = imgRefs.current[next];
      if (toEl) {
        gsap.set(toEl, { zIndex: 2 });
        gsap.fromTo(toEl, { opacity: 0 }, { opacity: 1, duration: 1.4, ease: "power1.inOut" });
      }
      if (fromEl) {
        gsap.to(fromEl, {
          opacity: 0,
          duration: 1.4,
          ease: "power1.inOut",
          onComplete: () => gsap.set(fromEl, { zIndex: 1 }),
        });
      }
      if (labelRef.current) {
        const label = labelRef.current;
        gsap.to(label, {
          opacity: 0,
          duration: 0.5,
          onComplete: () => {
            label.textContent = images[next]?.artistName ?? "";
            gsap.to(label, { opacity: 1, duration: 0.5 });
          },
        });
      }
    }, 5500);

    return () => window.clearInterval(id);
  }, [images]);

  if (images.length === 0) return null;

  const hasAnyArtistName = images.some((image) => image.artistName);

  return (
    <>
      {images.map((image, index) => (
        <FallbackImage
          key={`${image.src}-${index}`}
          ref={(node) => {
            imgRefs.current[index] = node;
          }}
          className="hero__artwork"
          src={image.src}
          alt={image.alt}
          style={{ opacity: index === 0 ? 1 : 0, zIndex: index === 0 ? 2 : 1 }}
          loading={index === 0 ? "eager" : "lazy"}
          decoding="async"
        />
      ))}
      {hasAnyArtistName ? <span className="hero__artist-label" ref={labelRef} /> : null}
    </>
  );
}
