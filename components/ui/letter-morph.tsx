"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface LetterMorphProps extends React.ComponentPropsWithoutRef<"span"> {
  words: string[];
  /** When supplied, the parent controls the exact word being shown. */
  value?: string;
  morphTime?: number;
  cooldownTime?: number;
  textClassName?: string;
  /** When supplied, the parent controls each individual word change. */
  advance?: number;
}

function blurFor(fraction: number) {
  const value = Math.max(fraction, 0.0001);
  return Math.min(8 / value - 8, 100);
}

/**
 * Morphs only the supplied word. Keep the surrounding sentence in normal
 * markup so screen readers and the reduced-motion path always receive a
 * complete, stable phrase.
 */
export function LetterMorph({
  words,
  value,
  morphTime = 1.2,
  cooldownTime = 1.5,
  className,
  textClassName,
  advance,
  ...props
}: LetterMorphProps) {
  const filterId = React.useId().replace(/:/g, "");
  const firstRef = React.useRef<HTMLSpanElement>(null);
  const secondRef = React.useRef<HTMLSpanElement>(null);
  const [reduceMotion, setReduceMotion] = React.useState(false);
  const [activeWord, setActiveWord] = React.useState("");
  const currentIndexRef = React.useRef(0);
  const lastAdvanceRef = React.useRef(advance ?? 0);
  const visibleLayerRef = React.useRef<"first" | "second">("first");
  const wordsKey = words.join("\0");
  const safeWords = React.useMemo(
    () => words.map((word) => word.trim()).filter(Boolean),
    // The content key prevents a parent render from restarting the morph.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [wordsKey],
  );
  const sizerWord = React.useMemo(
    () => safeWords.reduce((longest, word) => (word.length > longest.length ? word : longest), ""),
    [safeWords],
  );
  const morphSeconds = Math.max(morphTime, 0.05);
  const cooldownSeconds = Math.max(cooldownTime, 0);

  React.useEffect(() => {
    currentIndexRef.current = 0;
    lastAdvanceRef.current = advance ?? 0;
    const initialWord = value?.trim() || safeWords[0] || "";
    setActiveWord(initialWord);
    visibleLayerRef.current = "first";
  }, [safeWords]);

  React.useEffect(() => {
    if (advance === undefined || !firstRef.current || !secondRef.current) return;
    const initialWord = value?.trim() || safeWords[0] || "";
    firstRef.current.textContent = initialWord;
    secondRef.current.textContent = initialWord;
    firstRef.current.style.opacity = "100%";
    secondRef.current.style.opacity = "0%";
  }, [safeWords]);

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  React.useEffect(() => {
    // Controlled headline words are scheduled exclusively by HeroHeadline;
    // never let this component start its own competing timer.
    if (value !== undefined || advance !== undefined || reduceMotion || safeWords.length <= 1) return;

    let index = safeWords.length - 1;
    let last = performance.now();
    let morph = 0;
    let cooldown = cooldownSeconds;
    let frame = 0;
    let cancelled = false;

    const setFraction = (fraction: number) => {
      if (cancelled || !firstRef.current || !secondRef.current) return;
      secondRef.current.style.filter = `blur(${blurFor(fraction)}px)`;
      secondRef.current.style.opacity = `${Math.pow(fraction, 0.4) * 100}%`;
      const inverse = 1 - fraction;
      firstRef.current.style.filter = `blur(${blurFor(inverse)}px)`;
      firstRef.current.style.opacity = `${Math.pow(inverse, 0.4) * 100}%`;
    };

    const reset = () => {
      if (!firstRef.current || !secondRef.current) return;
      secondRef.current.style.filter = "";
      secondRef.current.style.opacity = "100%";
      firstRef.current.style.filter = "";
      firstRef.current.style.opacity = "0%";
    };

    const animate = (now: number) => {
      if (cancelled) return;
      frame = requestAnimationFrame(animate);
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      const wasCooling = cooldown > 0;
      cooldown -= dt;
      if (cooldown <= 0) {
        if (wasCooling) {
          index = (index + 1) % safeWords.length;
          firstRef.current!.textContent = safeWords[index] ?? "";
          secondRef.current!.textContent = safeWords[(index + 1) % safeWords.length] ?? "";
          setActiveWord(safeWords[index] ?? "");
          morph = 0;
        }
        morph += dt;
        const fraction = Math.min(morph / morphSeconds, 1);
        setFraction(fraction);
        if (fraction >= 1) cooldown = cooldownSeconds;
      } else {
        reset();
      }
    };

    firstRef.current!.textContent = safeWords[index] ?? "";
    secondRef.current!.textContent = safeWords[0] ?? "";
    reset();
    frame = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [advance, cooldownSeconds, morphSeconds, reduceMotion, safeWords]);

  React.useEffect(() => {
    if (value !== undefined || advance === undefined || safeWords.length <= 1 || advance === lastAdvanceRef.current) return;
    lastAdvanceRef.current = advance;
    currentIndexRef.current = (currentIndexRef.current + 1) % safeWords.length;
    const next = safeWords[currentIndexRef.current] ?? safeWords[0];
    setActiveWord(next);

    if (reduceMotion || !firstRef.current || !secondRef.current) return;
    let start = performance.now();
    let frame = 0;
    const from = firstRef.current;
    const to = secondRef.current;
    from.textContent = activeWord || safeWords[(currentIndexRef.current - 1 + safeWords.length) % safeWords.length] || "";
    to.textContent = next;
    const animate = (now: number) => {
      const fraction = Math.min((now - start) / (morphSeconds * 1000), 1);
      const value = Math.max(fraction, 0.0001);
      to.style.filter = `blur(${blurFor(value)}px)`;
      to.style.opacity = `${Math.pow(value, 0.4) * 100}%`;
      const inverse = 1 - fraction;
      from.style.filter = `blur(${blurFor(inverse)}px)`;
      from.style.opacity = `${Math.pow(inverse, 0.4) * 100}%`;
      if (fraction < 1) frame = requestAnimationFrame(animate);
      else {
        from.style.opacity = "0%";
        from.style.filter = "";
        to.style.opacity = "100%";
        to.style.filter = "";
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [activeWord, advance, morphSeconds, reduceMotion, safeWords]);

  React.useEffect(() => {
    if (value === undefined) return;
    const target = value.trim() || safeWords[0] || "";
    setActiveWord(target);
    // Reduced-motion renders a plain text span, so there are no morph layers
    // to update. The state update above is the complete controlled change.
    if (!firstRef.current || !secondRef.current) return;
    const visible = visibleLayerRef.current === "first" ? firstRef.current : secondRef.current;
    const hidden = visibleLayerRef.current === "first" ? secondRef.current : firstRef.current;
    const current = visible.textContent || "";
    if (!current) {
      visible.textContent = target;
      visible.style.filter = "";
      visible.style.opacity = "100%";
      hidden.style.opacity = "0%";
      return;
    }
    if (current === target) return;

    hidden.textContent = target;
    hidden.style.filter = "";
    hidden.style.opacity = reduceMotion ? "100%" : "0%";
    visible.style.filter = "";
    visible.style.opacity = "100%";
    if (reduceMotion) {
      visible.style.opacity = "0%";
      visibleLayerRef.current = visibleLayerRef.current === "first" ? "second" : "first";
      return;
    }

    let frame = 0;
    const start = performance.now();
    const animate = (now: number) => {
      const fraction = Math.min((now - start) / (morphSeconds * 1000), 1);
      const eased = Math.max(fraction, 0.0001);
      hidden.style.filter = `blur(${blurFor(eased)}px)`;
      hidden.style.opacity = `${Math.pow(eased, 0.4) * 100}%`;
      visible.style.filter = `blur(${blurFor(1 - fraction)}px)`;
      visible.style.opacity = `${Math.pow(1 - fraction, 0.4) * 100}%`;
      if (fraction < 1) frame = requestAnimationFrame(animate);
      else {
        hidden.style.filter = "";
        hidden.style.opacity = "100%";
        visible.style.filter = "";
        visible.style.opacity = "0%";
        visibleLayerRef.current = visibleLayerRef.current === "first" ? "second" : "first";
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [morphSeconds, reduceMotion, safeWords, value]);

  React.useEffect(() => {
    if (advance !== undefined || !reduceMotion || safeWords.length <= 1) return;
    const id = window.setInterval(() => {
      setActiveWord((previous) => {
        const index = Math.max(0, safeWords.indexOf(previous));
        return safeWords[(index + 1) % safeWords.length] ?? previous;
      });
    }, (morphSeconds + cooldownSeconds) * 1000);
    return () => window.clearInterval(id);
  }, [advance, cooldownSeconds, morphSeconds, reduceMotion, safeWords]);

  if (!safeWords.length) return null;
  const textClass = cn("font-semibold tracking-tight whitespace-nowrap", textClassName);

  if (reduceMotion || safeWords.length === 1) {
    return (
      <span data-slot="letter-morph" className={cn("relative inline-block align-baseline", className)} {...props}>
        <span className={cn("inline-block select-none", textClass)} aria-live="polite" aria-atomic="true">
          {activeWord || safeWords[0]}
        </span>
      </span>
    );
  }

  return (
    <span data-slot="letter-morph" className={cn("relative inline-block align-baseline", className)} {...props}>
      <span className="sr-only" aria-live="polite" aria-atomic="true">{activeWord}</span>
      <span aria-hidden className={cn("invisible inline-block", textClass)}>{sizerWord}</span>
      <svg className="pointer-events-none absolute size-0 overflow-hidden" aria-hidden>
        <defs>
          <filter id={filterId}>
            <feColorMatrix
              in="SourceGraphic"
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 255 -140"
            />
          </filter>
        </defs>
      </svg>
      <span aria-hidden className="absolute inset-0 flex items-center justify-start" style={{ filter: `url(#${filterId})` }}>
        <span ref={firstRef} className={cn("absolute inset-0 flex items-center justify-start select-none", textClass)}>
        </span>
        <span ref={secondRef} className={cn("absolute inset-0 flex items-center justify-start select-none", textClass)} />
      </span>
    </span>
  );
}
