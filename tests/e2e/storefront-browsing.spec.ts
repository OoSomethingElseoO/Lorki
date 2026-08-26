// Covers public storefront search and artist browsing end to end against
// the real running app: app/search/page.tsx, lib/storefront.ts
// (searchStorefront, getArtists, PAGE_SIZE), app/artists/page.tsx,
// app/artists/[slug]/page.tsx, and components/pagination.tsx.
//
// Pagination: the dev DB had exactly 12 artists at the time this suite was
// written — precisely PAGE_SIZE, one short of a second page. Rather than
// bulk-seed 13+ fixture rows just to exercise paging, the pagination
// scenario below seeds exactly ONE extra throwaway artist (createArtistFixture,
// named to sort last) to tip the count to 13 and land it deterministically
// on page 2 — proportionate because it only takes one more row on top of
// what's already there, not a from-scratch bulk seed.
import { createArtistFixture, expect, prisma, test } from "./fixtures/test-fixtures";

test.describe("Search", () => {
  test("searching for an existing artist's name returns that artist", async ({ page, originalArtwork }) => {
    await test.step("Given the search page", async () => {
      await page.goto("/search");
    });

    await test.step("When a visitor searches for an artist name that exists", async () => {
      // #search-q rather than getByLabel: the <form role="search"> landmark
      // and the <input> it wraps share the exact same aria-label text
      // ("Search artwork and artists"), so getByLabel resolves to both.
      await page.locator("#search-q").fill(originalArtwork.artist.name);
      await page.getByRole("button", { name: "Search" }).click();
    });

    await test.step("Then that artist appears in the results", async () => {
      await expect(page.getByRole("heading", { name: "Artists" })).toBeVisible();
      await expect(page.getByRole("heading", { name: originalArtwork.artist.name, level: 2 })).toBeVisible();
    });
  });

  test("searching for something that matches nothing shows a clear no-results message", async ({ page }) => {
    const nonsense = `no-such-thing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await test.step("Given the search page", async () => {
      await page.goto("/search");
    });

    await test.step("When a visitor searches for something that matches nothing", async () => {
      await page.locator("#search-q").fill(nonsense);
      await page.getByRole("button", { name: "Search" }).click();
    });

    await test.step("Then a clear no-results message shows instead", async () => {
      await expect(page.getByText(new RegExp(`No results for.*${nonsense}`))).toBeVisible();
    });
  });
});

test.describe("Artist page", () => {
  test("an artist's page shows their artwork and a working Back to artists link", async ({ page, originalArtwork }) => {
    await test.step("Given an artist with real artwork listed", async () => {
      const artworks = await prisma.artwork.findMany({ where: { campaignId: originalArtwork.campaign.id } });
      expect(artworks.length).toBeGreaterThan(0);
    });

    await test.step("When a visitor views that artist's page", async () => {
      await page.goto(`/artists/${originalArtwork.artist.slug}`);
    });

    await test.step("Then their artwork shows and a Back to artists link takes them back to /artists", async () => {
      await expect(page.getByRole("heading", { name: originalArtwork.artwork.title, level: 3 })).toBeVisible();

      const backLink = page.getByRole("link", { name: "Back to artists" });
      await expect(backLink).toBeVisible();
      await backLink.click();
      await expect(page).toHaveURL(/\/artists$/);
      await expect(page.getByRole("heading", { name: "Artists", level: 1 })).toBeVisible();
    });
  });
});

test.describe("Artist directory pagination", () => {
  test("the last page shows different results than page 1, including the newly added artist", async ({ page }) => {
    // Named to sort last (getArtists orders by name asc — see
    // createArtistFixture's own comment), so it deterministically lands on
    // the LAST page regardless of exactly how many artists already exist.
    const extraArtist = await createArtistFixture();

    try {
      const totalCount = await prisma.artist.count();
      const totalPages = Math.max(1, Math.ceil(totalCount / 12));
      expect(totalPages).toBeGreaterThan(1);

      let page1Names: string[] = [];
      await test.step(`Given ${totalCount} artists now span ${totalPages} pages, when a visitor views page 1`, async () => {
        await page.goto("/artists");
        await expect(page.getByText(new RegExp(`Page 1 of ${totalPages}`))).toBeVisible();
        page1Names = await page.locator(".artist-card h2").allTextContents();
        expect(page1Names).not.toContain(extraArtist.artist.name);
      });

      await test.step("Then the last page shows different results, including the newest artist", async () => {
        await page.goto(`/artists?page=${totalPages}`);
        await expect(page.getByText(new RegExp(`Page ${totalPages} of ${totalPages}`))).toBeVisible();
        const lastPageNames = await page.locator(".artist-card h2").allTextContents();

        expect(lastPageNames).toContain(extraArtist.artist.name);
        expect(lastPageNames.some((name) => page1Names.includes(name))).toBe(false);
      });
    } finally {
      await extraArtist.cleanup();
    }
  });
});
