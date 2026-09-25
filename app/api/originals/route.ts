import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getLiveArtworksByKind } from "@/lib/storefront";

const getCachedOriginalsPage = unstable_cache(
  async (page: number) => getLiveArtworksByKind("ORIGINAL", page),
  ["originals-infinite-feed"],
  { revalidate: 30 },
);

export async function GET(request: Request) {
  const pageValue = new URL(request.url).searchParams.get("page");
  const page = Number(pageValue ?? "1");

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "page must be a positive integer" }, { status: 400 });
  }

  const result = await getCachedOriginalsPage(page);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" },
  });
}
