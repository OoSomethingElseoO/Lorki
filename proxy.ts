import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifyUserSessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// proxy.ts runs on the Node.js runtime in Next.js 16 (not Edge), so a real
// database read is fine here — role checks (isAdmin, has a linked Artist)
// are always looked up fresh, never baked into the session token. That
// means a promotion (made an admin, started selling) takes effect on the
// very next request instead of requiring a re-login.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");
  const isArtistRoute = pathname.startsWith("/artist") || pathname.startsWith("/api/artist");

  if (!isAdminRoute && !isArtistRoute) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const userId = await verifyUserSessionToken(token);

  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId }, include: { artist: true } })
    : null;

  const isApi = pathname.startsWith("/api/");

  if (isAdminRoute) {
    if (user?.isAdmin) {
      return NextResponse.next();
    }
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // isArtistRoute
  const isOnboarding = pathname === "/artist/onboarding" || pathname === "/api/artist/onboarding";

  if (user?.artist) {
    return NextResponse.next();
  }
  // Onboarding is for a logged-in user who does NOT have a shop yet — this
  // is exactly the route that creates one, so it can't require having one
  // already.
  if (user && isOnboarding) {
    return NextResponse.next();
  }
  if (isApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Logged in but no shop yet — send them to become one instead of a bare
  // login page they've already passed.
  if (user && !isOnboarding) {
    return NextResponse.redirect(new URL("/artist/onboarding", request.url));
  }
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/artist/:path*", "/api/artist/:path*"],
};
