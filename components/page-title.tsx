import type { ReactNode } from "react";
import { TextBlockAnimation } from "@/components/ui/text-block-animation";

type PageTitleProps = {
  children: ReactNode;
};

// A server component rendering a "use client" child (TextBlockAnimation) is
// the normal App Router pattern — only serializable props (a ReactNode
// here) cross that boundary, so this doesn't need "use client" itself.
// Shared by every public page's <h1> (16 pages at last count), so this one
// change is what makes the block-reveal a real site-wide signature moment
// rather than a homepage-only flourish.
export function PageTitle({ children }: PageTitleProps) {
  return (
    <header className="page-title">
      <TextBlockAnimation blockColor="var(--gold)" animateOnScroll={false} duration={0.7}>
        <h1>{children}</h1>
      </TextBlockAnimation>
    </header>
  );
}
