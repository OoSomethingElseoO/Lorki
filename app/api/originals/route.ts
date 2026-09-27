import { apiContractError, apiJson } from "@/lib/api-contract";
import { unstable_cache } from "next/cache";
import { getLiveArtworksByKind } from "@/lib/storefront";
import { isFeatureEnabled } from "@/lib/feature-flags";

const getCachedOriginalsPage = unstable_cache(
  async (page: number) => getLiveArtworksByKind("ORIGINAL", page),
  ["originals-infinite-feed"],
  { revalidate: 30 },
);

export async function GET(request: Request) {
  if (!isFeatureEnabled("ORIGINALS_INFINITE_SCROLL")) {
    return apiContractError("FEATURE_DISABLED", "Originals infinite scroll is disabled", 503);
  }
  const pageValue = new URL(request.url).searchParams.get("page");
  const page = Number(pageValue ?? "1");

  if (!Number.isInteger(page) || page < 1) {
    return apiContractError("INVALID_PAGE", "page must be a positive integer", 400, { field: "page" });
  }

  const result = await getCachedOriginalsPage(page);
  return apiJson(result, {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=120" },
  });
}
