import type { Metadata } from "next";
import { Fraunces, Lora } from "next/font/google";
import "./globals.css";
import { getBranding } from "@/lib/settings";
import { StyledComponentsRegistry } from "@/lib/styled-components-registry";
import { KineticSkew } from "@/components/kinetic-skew";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  axes: ["opsz", "SOFT", "WONK"],
});

const lora = Lora({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

// Next.js resolves root-layout metadata for every route during static
// prerendering, even fully static pages like /_not-found — so this runs
// during `next build` regardless of whether the visited page itself is
// static or dynamic. getBranding() already degrades to a hardcoded default
// if the database isn't reachable (no build-time DB access on most hosts,
// Render included), so this never needs its own fallback.
export async function generateMetadata(): Promise<Metadata> {
  const { siteName } = await getBranding();
  return {
    title: siteName,
    description: "An accessibility-first homepage for an original artwork website.",
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the theme-init script below deliberately
    // mutates this element's data-theme attribute before hydration (to
    // apply a stored preference without a flash of the default theme) —
    // without this, React treats that expected, intentional divergence
    // from the server-rendered markup as a hydration error.
    <html lang="en" className={`${fraunces.variable} ${lora.variable}`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so a stored theme preference applies
            immediately — without this, the page would flash the default
            theme and then snap to the stored one once React hydrates. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();',
          }}
        />
        {/* Marks JS as available before paint so .reveal (see globals.css)
            can opt into starting hidden — content stays visible by default
            if this never runs (JS blocked/failed), instead of being stuck
            invisible waiting on an IntersectionObserver that never fires. */}
        <script
          dangerouslySetInnerHTML={{
            __html: 'document.documentElement.classList.add("js");',
          }}
        />
      </head>
      <body>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
        <KineticSkew />
      </body>
    </html>
  );
}
