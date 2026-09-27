import { apiJson, apiContractError } from "@/lib/api-contract";
import { getProductCatalogue, type ProductFilters } from "@/lib/storefront";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (await isRateLimited(`products:${getRequestIp(request)}`, 120, 60_000)) {
    return apiContractError("RATE_LIMITED", "Too many catalogue requests", 429);
  }
  const params = new URL(request.url).searchParams;
  const raw = params.get("page") ?? "1";
  const page = Number(raw);
  if (!Number.isInteger(page) || page < 1) return apiContractError("INVALID_PAGE", "page must be a positive integer", 400, { field: "page" });
  const rawQuery = params.get("q")?.trim() ?? "";
  if (rawQuery.length > 100) return apiContractError("QUERY_TOO_LONG", "Search query is too long", 400, { field: "q" });
  const kind = params.get("kind");
  const sort = params.get("sort");
  const min = params.get("minPrice");
  const max = params.get("maxPrice");
  const filters: ProductFilters = { q: rawQuery || undefined, kind: kind === "ORIGINAL" || kind === "PRINT" ? kind : "ALL", artist: params.get("artist")?.trim().slice(0, 100) || undefined, dateFrom: params.get("dateFrom") || undefined, dateTo: params.get("dateTo") || undefined, sort: sort === "oldest" || sort === "price_asc" || sort === "price_desc" ? sort : "newest", minPriceCents: min && Number.isInteger(Number(min)) ? Number(min) * 100 : undefined, maxPriceCents: max && Number.isInteger(Number(max)) ? Number(max) * 100 : undefined };
  return apiJson(await getProductCatalogue(page, filters), { headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120" } });
}
