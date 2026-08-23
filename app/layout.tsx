import type { Metadata } from "next";
import { Fraunces, Lora } from "next/font/google";
import "./globals.css";
import { getBranding } from "@/lib/settings";

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
    <html lang="en" className={`${fraunces.variable} ${lora.variable}`}>
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
      </head>
      <body>{children}</body>
    </html>
  );
}
