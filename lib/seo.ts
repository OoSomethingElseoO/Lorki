import type { Metadata } from "next";
import { absoluteSiteUrl, getSiteUrl } from "@/lib/site-url";

/** Build metadata without falling back to a fake host in production. */
export function publicMetadata(input: {
  title: string;
  description: string;
  pathname: string;
  image?: string | null;
  type?: "website" | "article";
  publishedTime?: Date;
}): Metadata {
  const image = input.image || undefined;
  const canonical = absoluteSiteUrl(input.pathname);
  return {
    title: input.title,
    description: input.description,
    ...(canonical ? { alternates: { canonical } } : {}),
    openGraph: {
      title: input.title,
      description: input.description,
      type: input.type ?? "website",
      ...(canonical ? { url: canonical } : {}),
      ...(image ? { images: [{ url: image }] } : {}),
      ...(input.publishedTime ? { publishedTime: input.publishedTime.toISOString() } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

/** JSON-LD must be escaped before being placed in an inline script. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function absoluteOrRelative(pathname: string): string {
  return absoluteSiteUrl(pathname) ?? pathname;
}

export function imageUrlForSchema(value: string | null | undefined): string | undefined {
  return value ? absoluteOrRelative(value) : undefined;
}

export function siteName(): string {
  return getSiteUrl()?.hostname ?? "Lorki Originals";
}
