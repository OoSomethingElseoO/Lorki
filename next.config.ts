import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
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
};

export default nextConfig;
