"use client";

import { useEffect, useMemo, useState } from "react";
import { LetterMorph } from "@/components/ui/letter-morph";
import type { HeroHeadlineWords } from "@/components/hero";

type HeroHeadlineProps = {
  words: HeroHeadlineWords;
  ariaLabel: string;
};

/**
 * The headline is deliberately split into three independently controlled
 * lines. The change order is readable: top → middle → bottom, then bottom →
 * middle → top. Each noun and its full stop are passed as one morphing value.
 */
export function HeroHeadline({ words, ariaLabel }: HeroHeadlineProps) {
  const [step, setStep] = useState(0);
  const sequence = useMemo(() => [0, 1, 2, 2, 1, 0], []);

  useEffect(() => {
    // The parent is the only scheduler. Hold each completed word for three
    // seconds, then advance exactly one line: top → middle → bottom, and
    // back bottom → middle → top.
    const timer = window.setInterval(() => setStep((value) => value + 1), 3000);
    return () => window.clearInterval(timer);
  }, []);


  const indexes = [0, 1, 2].map((line) => {
    // Every complete up/down pass changes each line twice. Preserve that
    // progress when the six-step sequence loops instead of snapping all
    // words back to the first option.
    let count = Math.floor(step / sequence.length) * 2;
    for (let i = 0; i < step % sequence.length; i += 1) {
      if (sequence[i] === line) count += 1;
    }
    return count;
  });
  const first = words.first[indexes[0] % Math.max(words.first.length, 1)] ?? "art";
  const second = words.second[indexes[1] % Math.max(words.second.length, 1)] ?? "masterpieces";
  const third = words.third[indexes[2] % Math.max(words.third.length, 1)] ?? "wildlife";
  const firstWords = words.first.map((word) => `${word}.`);
  const secondWords = words.second.map((word) => `${word}.`);
  const thirdWords = words.third.map((word) => `${word}.`);

  return (
    <h1 className="hero__title" id="home-title" aria-label={ariaLabel}>
      <span className="hero__title-line hero__title-primary">
        <span className="hero__title-prefix">Sell</span>
        <LetterMorph words={firstWords} value={`${first}.`} morphTime={0.8} textClassName="hero__morph-word" />
      </span>
      <span className="hero__title-line hero__title-secondary">
        <span className="hero__title-prefix">Own</span>
        <LetterMorph words={secondWords} value={`${second}.`} morphTime={0.8} textClassName="hero__morph-word" />
      </span>
      <span className="hero__title-line hero__title-tertiary">
        <span className="hero__title-prefix">Protect</span>
        <LetterMorph words={thirdWords} value={`${third}.`} morphTime={0.8} textClassName="hero__morph-word" />
      </span>
    </h1>
  );
}
