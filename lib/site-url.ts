/** The canonical public origin must be configured per deployment. */
export function getSiteUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.SITE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && process.env.NODE_ENV === "production") return null;
    url.pathname = url.pathname.replace(/\/$/, "");
    return url;
  } catch {
    return null;
  }
}

export function absoluteSiteUrl(pathname: string): string | null {
  const base = getSiteUrl();
  return base ? new URL(pathname.replace(/^\//, "/"), `${base.toString().replace(/\/$/, "")}/`).toString() : null;
}
