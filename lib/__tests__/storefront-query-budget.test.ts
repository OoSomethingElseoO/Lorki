import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A small source-level regression budget for the highest-traffic storefront
 * reads. Prisma's nested include is the query boundary here: adding a
 * per-artwork artist lookup inside the mapper would turn one page into N+1
 * queries. This test intentionally checks the shape, not a mocked query
 * count, so it cannot pass by merely stubbing the database.
 */
test("storefront artwork paths keep joins batched and mapping query-free", async () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = await readFile(join(here, "..", "storefront.ts"), "utf8");
  const liveList = source.slice(source.indexOf("export async function getLiveArtworksByKind"), source.indexOf("export async function getLiveArtworkById"));
  const carousel = source.slice(source.indexOf("export const getCarouselArtworks"), source.indexOf("export async function getArtists"));
  const mapper = source.slice(source.indexOf("function mapArtwork"), source.indexOf("export async function getLiveNewsArticles"));

  assert.match(liveList, /Promise\.all\(\[/, "listing must batch artwork and count reads");
  assert.match(liveList, /include:[\s\S]*campaign:[\s\S]*include:[\s\S]*artist:\s*true/);
  assert.match(carousel, /unstable_cache/);
  assert.match(carousel, /include:[\s\S]*campaign:[\s\S]*include:[\s\S]*artist:\s*true/);
  assert.doesNotMatch(mapper, /prisma\./, "mapping must not issue one query per artwork");
});
