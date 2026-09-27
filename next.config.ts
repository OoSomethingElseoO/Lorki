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
  experimental: {
    // Tree-shake the large icon/animation packages at import time. This keeps
    // route bundles from shipping every icon or motion helper to the browser.
    optimizePackageImports: ["lucide-react", "framer-motion"],
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
  // Security headers, including the per-request nonce CSP, are applied in
  // proxy.ts so the two intentional bootstrap scripts can be authorized
  // without allowing arbitrary inline scripts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      {
        source: "/sitemap.xml",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      {
        source: "/robots.txt",
        headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }],
      },
      // robots.txt is advisory. These response headers make the indexing
      // policy explicit for authenticated, transactional, and operational
      // routes even when a crawler reaches them directly.
      ...["/admin/:path*", "/api/:path*", "/account/:path*", "/artist/:path*", "/cause/:path*", "/checkout/:path*", "/login", "/signup", "/forgot-password", "/reset-password/:path*"].map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet" }],
      })),
    ];
  },
};

export default nextConfig;
