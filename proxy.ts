import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyUserSessionTokenDetails } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// sameSite: "lax" on the session cookie (see app/api/login/route.ts) already
// blocks a real cross-site form POST from ever carrying it, but that's
// browser-version-dependent and not a substitute for actually checking
// where a state-changing request came from. Real webhooks (Stripe,
// Flutterwave) are genuine server-to-server POSTs with no same-origin
// Origin/Referer to check — those are authenticated by signature
// verification inside their own routes instead, not by this middleware, so
// they're excluded here rather than made to fail a check that was never
// meant for them.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// request.nextUrl.origin reflects the server's own bind address/port (here,
// 0.0.0.0 — see server.js's HOSTNAME fallback), not what the client
// actually connected to — confirmed live: a request with a genuinely
// correct same-origin Origin header still failed a same.origin check
// against it. X-Forwarded-Host/Host is what a reverse proxy (Render,
// same as getRequestIp already trusts X-Forwarded-For for) or the request
// itself actually carries, and what a browser's Origin header is really
// compared against in practice.
function getExpectedOrigin(request: NextRequest): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${proto}://${host}`;
}

function isSameOriginRequest(request: NextRequest): boolean {
  const expected = getExpectedOrigin(request);
  const origin = request.headers.get("origin");
  if (origin) {
    return origin === expected;
  }
  // Browsers attach Origin to essentially every same-site POST/PATCH/etc.
  // (fetch, XHR, or a plain <form> submit) — its absence here means this
  // wasn't a normal browser-driven request in the first place. Referer is
  // the one legitimate fallback for that case, not a workaround for a
  // missing Origin on a real browser request.
  const referer = request.headers.get("referer");
  if (!referer) {
    return false;
  }
  try {
    return new URL(referer).origin === expected;
  } catch {
    return false;
  }
}

// proxy.ts runs on the Node.js runtime in Next.js 16 (not Edge), so a real
// database read is fine here — role checks (isAdmin, has a linked Artist)
// are always looked up fresh, never baked into the session token. That
// means a promotion (made an admin, started selling) takes effect on the
// very next request instead of requiring a re-login.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // Accept a caller-supplied correlation ID only when it is a bounded opaque
  // token. Otherwise mint one at the trust boundary. Forward it to route
  // handlers and expose it on every middleware response so support can trace
  // a request without trusting arbitrary header contents.
  const suppliedRequestId = request.headers.get("x-request-id")?.trim();
  const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const forwardedHeaders = new Headers(request.headers);
  forwardedHeaders.set("x-request-id", requestId);
  forwardedHeaders.set("x-csp-nonce", nonce);
  const contentSecurityPolicy = ["default-src 'self'", `script-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`, "style-src 'self' 'unsafe-inline'", "img-src 'self' https: data: blob:", "font-src 'self' data:", "connect-src 'self'", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"].join("; ");
  const next = () => {
    const response = NextResponse.next({ request: { headers: forwardedHeaders } });
    response.headers.set("x-request-id", requestId);
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  };
  const withRequestId = (response: Response) => {
    response.headers.set("x-request-id", requestId);
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
    return response;
  };

  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/webhooks/") &&
    !SAFE_METHODS.has(request.method) &&
    !isSameOriginRequest(request)
  ) {
    return withRequestId(NextResponse.json({ error: "Cross-site request rejected" }, { status: 403 }));
  }

  // Match route segments, not string prefixes: `/artists` is public, while
  // `/artist` is the authenticated seller dashboard. A raw startsWith
  // check would incorrectly send every public artist profile to login.
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/api/admin" || pathname.startsWith("/api/admin/");
  const isArtistRoute = pathname === "/artist" || pathname.startsWith("/artist/") || pathname === "/api/artist" || pathname.startsWith("/api/artist/");

  if (!isAdminRoute && !isArtistRoute) {
    return next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const details = await verifyUserSessionTokenDetails(token);

  const user = details
    ? await prisma.user.findFirst({ where: { id: details.userId, accountStatus: "ACTIVE", ...(details.sessionVersion === null ? {} : { sessionVersion: details.sessionVersion }) }, include: { artist: true } })
    : null;

  const isApi = pathname.startsWith("/api/");

  if (isAdminRoute) {
    if (user?.isAdmin) {
      return next();
    }
    if (isApi) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return withRequestId(NextResponse.redirect(loginUrl));
  }

  // isArtistRoute
  const isOnboarding = pathname === "/artist/onboarding" || pathname === "/api/artist/onboarding";

  if (user?.artist) {
    return next();
  }
  // Onboarding is for a logged-in user who does NOT have a shop yet — this
  // is exactly the route that creates one, so it can't require having one
  // already.
  if (user && isOnboarding) {
    return next();
  }
  if (isApi) {
    return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }));
  }
  // Logged in but no shop yet — send them to become one instead of a bare
  // login page they've already passed.
  if (user && !isOnboarding) {
    return withRequestId(NextResponse.redirect(new URL("/artist/onboarding", request.url)));
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return withRequestId(NextResponse.redirect(loginUrl));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
