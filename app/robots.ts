import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/", "/account/", "/artist/", "/cause/", "/checkout/", "/login", "/signup", "/forgot-password", "/reset-password/"] },
    ],
    ...(siteUrl ? { sitemap: new URL("/sitemap.xml", siteUrl).toString() } : {}),
  };
}
