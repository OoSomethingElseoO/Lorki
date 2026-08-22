import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/auth";
import { SELLER_SESSION_COOKIE, verifySellerSessionToken } from "@/lib/seller-auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi = pathname.startsWith("/api/admin") && pathname !== "/api/admin/login";
  const isAdminPage = pathname.startsWith("/admin") && pathname !== "/admin/login";

  if (isAdminApi || isAdminPage) {
    const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
    const valid = await isValidAdminSessionToken(token);

    if (valid) {
      return NextResponse.next();
    }

    if (isAdminApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const publicSellerPaths = ["/seller/login", "/seller/signup"];
  const publicSellerApi = ["/api/seller/login", "/api/seller/signup"];
  const isSellerApi = pathname.startsWith("/api/seller") && !publicSellerApi.includes(pathname);
  const isSellerPage = pathname.startsWith("/seller") && !publicSellerPaths.includes(pathname);

  if (isSellerApi || isSellerPage) {
    const token = request.cookies.get(SELLER_SESSION_COOKIE)?.value;
    const artistId = await verifySellerSessionToken(token);

    if (artistId) {
      return NextResponse.next();
    }

    if (isSellerApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/seller/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/seller/:path*", "/api/seller/:path*"],
};
