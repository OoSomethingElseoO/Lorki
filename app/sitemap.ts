import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

const publicRoutes = ["/", "/products", "/originals", "/prints", "/artists", "/news", "/impact", "/mission-statement", "/contact-us"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  if (!siteUrl) return [];
  const now = new Date();
  const urls: MetadataRoute.Sitemap = publicRoutes.map((path) => ({ url: new URL(path, siteUrl).toString(), lastModified: now, changeFrequency: path === "/" ? "daily" : "weekly", priority: path === "/" ? 1 : 0.7 }));
  const [artists, artworks, articles] = await Promise.all([
    prisma.artist.findMany({ select: { slug: true, createdAt: true } }),
    prisma.artwork.findMany({ where: { isPublished: true, campaign: { status: "LIVE" } }, select: { id: true, createdAt: true } }),
    prisma.newsArticle.findMany({ where: { status: "LIVE" }, select: { slug: true, createdAt: true } }),
  ]);
  urls.push(...artists.map((artist) => ({ url: new URL(`/artists/${encodeURIComponent(artist.slug)}`, siteUrl).toString(), lastModified: artist.createdAt, changeFrequency: "monthly" as const, priority: 0.6 })));
  urls.push(...artworks.map((artwork) => ({ url: new URL(`/artworks/${encodeURIComponent(artwork.id)}`, siteUrl).toString(), lastModified: artwork.createdAt, changeFrequency: "weekly" as const, priority: 0.7 })));
  urls.push(...articles.map((article) => ({ url: new URL(`/news/${encodeURIComponent(article.slug)}`, siteUrl).toString(), lastModified: article.createdAt, changeFrequency: "weekly" as const, priority: 0.6 })));
  return urls;
}
