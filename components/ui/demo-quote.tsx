"use client";

import DotPattern from "@/components/ui/dot-pattern-1";

// Corner-bracketed pull-quote block — brand pass on the original demo:
// red-500 accents/border become --gold (the site's one accent color), and
// the quote itself uses the display serif (Fraunces) instead of the
// default sans stack, matching every other heading in the app.
export function Quote() {
  return (
    <div className="mx-auto mb-10 max-w-7xl px-6 md:mb-20 xl:px-0">
      <div className="relative flex flex-col items-center border border-gold">
        <DotPattern width={5} height={5} />

        <div className="absolute -left-1.5 -top-1.5 h-3 w-3 bg-gold" />
        <div className="absolute -bottom-1.5 -left-1.5 h-3 w-3 bg-gold" />
        <div className="absolute -right-1.5 -top-1.5 h-3 w-3 bg-gold" />
        <div className="absolute -bottom-1.5 -right-1.5 h-3 w-3 bg-gold" />

        <div className="relative z-20 mx-auto max-w-7xl py-6 md:p-10 xl:py-20">
          <p className="md:text-md text-xs text-gold lg:text-lg xl:text-2xl">I believe</p>
          <div className="font-[family-name:var(--font-display)] text-2xl tracking-tighter text-ink md:text-5xl lg:text-7xl xl:text-8xl">
            <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-3 xl:gap-4">
              <h1 className="font-semibold">&ldquo;Design should be</h1>
              <p className="font-light">easy to</p>
            </div>
            <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-3 xl:gap-4">
              <p className="font-light">understand</p>
              <h1 className="font-semibold">because</h1>
              <p className="font-light">simple</p>
            </div>
            <div className="flex flex-wrap gap-1 md:gap-2 lg:gap-3 xl:gap-4">
              <p className="font-light">ideas</p>
              <h1 className="font-semibold">are quicker to</h1>
            </div>
            <h1 className="font-semibold">grasp...&rdquo;</h1>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DemoQuote() {
  return <Quote />;
}
