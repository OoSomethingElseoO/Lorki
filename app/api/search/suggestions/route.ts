import { apiContractError, apiJson } from "@/lib/api-contract";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { searchStorefront } from "@/lib/storefront";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return apiJson({ query, suggestions: [] }, { headers: { "Cache-Control": "public, max-age=30" } });
  if (await isRateLimited(`search-suggestions:${getRequestIp(request)}`, 60, 60_000)) {
    return apiContractError("RATE_LIMITED", "Too many search requests", 429);
  }

  const results = await searchStorefront(query);
  const suggestions = [
    ...results.artworks.slice(0, 5).map((artwork) => ({
      type: "artwork" as const,
      id: artwork.id,
      label: artwork.title,
      detail: artwork.artistName,
      href: `/artworks/${artwork.id}`,
    })),
    ...results.artists.slice(0, 5).map((artist) => ({
      type: "artist" as const,
      id: artist.slug,
      label: artist.name,
      detail: "Artist",
      href: `/artists/${artist.slug}`,
    })),
  ].slice(0, 8);

  return apiJson({ query, suggestions }, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
