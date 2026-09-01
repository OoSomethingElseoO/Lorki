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
};

export default nextConfig;
