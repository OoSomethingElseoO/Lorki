"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { SplitText } from "gsap/SplitText";
import { buttonVariants } from "@/components/ui/button";
import { Magnetic } from "@/components/ui/magnetic";

if (typeof window !== "undefined") gsap.registerPlugin(SplitText);

export type HeroImage = { src: string; alt: string };

type HeroProps = {
  eyebrow: string;
  title: string;
  tagline: string;
  /**
   * One entry: shown statically (this is always the case when an admin has
   * set settings.heroImageUrl, or when there's only a single fallback
   * image). Multiple entries: crossfades slowly through them — only used
   * when there's no admin override, cycling through live inventory.
   */
  images: HeroImage[];
};

export function Hero({ eyebrow, title, tagline, images }: HeroProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  // SplitText line-reveal entrance + staggered fade-up for the rest of the
  // copy. Skipped entirely under prefers-reduced-motion: since gsap.from()
  // is what pushes elements away from their resting state in the first
  // place, never running it means they simply render at that resting
  // state directly — no separate "snap to settled" branch needed.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!titleRef.current) return;

    const split = SplitText.create(titleRef.current, {
      type: "lines",
      mask: "lines",
      linesClass: "hero__title-line",
    });

    const tl = gsap.timeline({ delay: 0.2 });
    tl.from(split.lines, {
      yPercent: 115,
      duration: 1,
      ease: "expo.out",
      stagger: 0.12,
    }).from(
      ".hero__fade",
      { y: 22, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.08 },
      "-=0.65",
    );

    return () => {
      tl.kill();
      split.revert();
    };
  }, [title]);

  return (
    <section className="hero" aria-labelledby="home-title">
      <div className="hero__copy" data-skew>
        <span className="hero__eyebrow hero__fade">{eyebrow}</span>
        <h1 className="hero__title" id="home-title" ref={titleRef}>
          {title}
        </h1>
        <p className="hero__tagline hero__fade">{tagline}</p>
        <div className="hero__actions hero__fade">
          <Magnetic>
            <Link href="/originals" className={buttonVariants()}>
              Browse originals
            </Link>
          </Magnetic>
          <Magnetic>
            <Link href="/impact" className="hero__actions-link">
              See where the money goes
            </Link>
          </Magnetic>
        </div>
      </div>
      <div className="hero__frame">
        <HeroArtwork images={images} />
      </div>
    </section>
  );
}

function HeroArtwork({ images }: { images: HeroImage[] }) {
  const imgRefs = useRef<(HTMLImageElement | null)[]>([]);
  const activeRef = useRef(0);

  // Slow crossfade through a handful of live pieces — only runs at all
  // when there's more than one image (i.e. no admin override) and motion
  // isn't reduced. Deliberately imperative/ref-driven rather than React
  // state: letting GSAP fully own each <img>'s opacity means a re-render
  // mid-fade can never stomp on an in-flight tween's interpolated value.
  useEffect(() => {
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
    }, 5500);

    return () => window.clearInterval(id);
  }, [images]);

  if (images.length === 0) return null;

  return (
    <>
      {images.map((image, index) => (
        <img
          key={`${image.src}-${index}`}
          ref={(node) => {
            imgRefs.current[index] = node;
          }}
          className="hero__artwork"
          src={image.src}
          alt={image.alt}
          style={{ opacity: index === 0 ? 1 : 0, zIndex: index === 0 ? 2 : 1 }}
          loading={index === 0 ? "eager" : "lazy"}
        />
      ))}
    </>
  );
}
