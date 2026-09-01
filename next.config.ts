import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  // A stray package-lock.json one directory up (in the parent
  // Personal_Projects folder, unrelated to this repo) made Next.js infer
  // that as the workspace root instead of this project — every standalone
  // build then nested server.js under a deep, absolute-path-mirroring
  // directory (.next/standalone/Personal_Projects/Lorki/server.js)
  // instead of .next/standalone/server.js, which isn't portable across
  // machines/hosts with a different absolute path. Pinning this explicitly
  // keeps the standalone output flat and predictable regardless of what
  // else happens to sit in a parent directory.
  outputFileTracingRoot: path.join(__dirname),
  compiler: {
    styledComponents: true,
  },
  // "Seller" was renamed to "artist" throughout (routes, components,
  // internal naming) — app/seller and app/api/seller no longer exist.
  // These permanent redirects exist purely so any bookmark, external link,
  // or search-engine index pointing at the old URLs still resolves.
  // next.config.js redirects run before proxy.ts (Next's Middleware) in
  // the request lifecycle, so old /seller and /api/seller requests never
  // reach proxy.ts's (now /artist-only) auth gating below — they're
  // redirected first. permanent: true sends a 308, which — unlike 301/302
  // — preserves the original request method and body, so this is safe for
  // old /api/seller/* POST/PATCH/DELETE calls too, not just GETs.
  async redirects() {
    return [
      { source: "/seller", destination: "/artist", permanent: true },
      { source: "/seller/:path*", destination: "/artist/:path*", permanent: true },
      { source: "/api/seller/:path*", destination: "/api/artist/:path*", permanent: true },
    ];
  },
  // No security headers were set anywhere in the app before this — Next.js
  // doesn't add any by default. This is a real, meaningful CSP, not a
  // maximal one: script-src/style-src need 'unsafe-inline' because this
  // app genuinely uses inline scripts (the theme/no-JS-reveal bootstrap in
  // app/layout.tsx, which must run before paint) and styled-components
  // renders inline <style> tags — a nonce-based CSP would remove that
  // need, but is a much larger, riskier rewrite than this gap warrants
  // right now. img-src stays broad (not 'self') because admin settings
  // and artist/artwork forms explicitly accept "paste any image URL", a
  // real, intended feature, not an oversight.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src * data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
