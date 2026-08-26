// Covers seller self-management end to end against the real running app:
// /seller/profile (SellerSettingsPanel -> SellerProfileForm ->
// /api/seller/profile) and /seller/artworks (the listings-management page
// and /api/seller/artworks/[id]).
//
// Every scenario runs as a `loggedInSeller` (tests/e2e/fixtures/db.ts's
// createSellerFixture: a real User+session cookie linked to an Artist,
// with one LIVE campaign and one artwork already on it) and cleans up via
// that fixture's own cleanup(), or via createSellerFixture directly (same
// pattern admin-crud.spec.ts uses for createConservancyFixture({ verified:
// true })) when a scenario needs a non-default starting inventory state.
//
import { createSellerFixture, expect, prisma, test } from "./fixtures/test-fixtures";

test.describe("Seller profile", () => {
  test("a seller edits their profile via /seller/profile and the changes persist across reload", async ({
    page,
    loggedInSeller,
  }) => {
    const newName = `E2E Updated Name ${loggedInSeller.tag}`;
    const newCountry = "Ethiopia";
    const newBio = "Updated throwaway bio from the Playwright E2E suite.";

    await test.step("Given a logged-in seller on /seller/profile", async () => {
      await page.goto("/seller/profile");
      await expect(page.getByRole("heading", { name: "Your Profile" })).toBeVisible();
      // Sanity-check we're looking at the seeded seller's own data before
      // changing it.
      await expect(page.getByLabel("Name")).toHaveValue(loggedInSeller.artist.name);
    });

    await test.step("When they edit name/country/bio and save", async () => {
      await page.getByLabel("Name").fill(newName);
      await page.getByLabel("Country").fill(newCountry);
      await page.getByLabel("Bio").fill(newBio);
      await page.getByRole("button", { name: "Save changes" }).click();
      await expect(page.getByText("Profile saved.")).toBeVisible();
    });

    await test.step("Then the changes persist and show on reload, and the DB row reflects them", async () => {
      await page.reload();
      await expect(page.getByLabel("Name")).toHaveValue(newName);
      await expect(page.getByLabel("Country")).toHaveValue(newCountry);
      await expect(page.getByLabel("Bio")).toHaveValue(newBio);

      const fresh = await prisma.artist.findUniqueOrThrow({ where: { id: loggedInSeller.artist.id } });
      expect(fresh.name).toBe(newName);
      expect(fresh.country).toBe(newCountry);
      expect(fresh.bio).toBe(newBio);
    });
  });
});

test.describe("Seller listings", () => {
  test("editing an existing listing's title/price updates it on /seller/artworks and in the DB", async ({
    page,
    loggedInSeller,
  }) => {
    const newTitle = `E2E Updated Listing ${loggedInSeller.tag}`;
    const newPriceCents = 275_000;

    await test.step("Given a seller with an existing (non-SOLD) artwork listing", async () => {
      await page.goto("/seller/artworks");
      await expect(page.locator("tr", { hasText: loggedInSeller.artwork.title })).toBeVisible();
      expect(loggedInSeller.artwork.inventoryState).toBe("AVAILABLE");
    });

    await test.step("When they click Edit, change the title/price, and save", async () => {
      const row = page.locator("tr", { hasText: loggedInSeller.artwork.title });
      await row.getByRole("button", { name: "Edit" }).click();

      const form = page.locator('form:has(input[name="title"])');
      await form.locator('input[name="title"]').fill(newTitle);
      await form.locator('input[name="priceDollars"]').fill((newPriceCents / 100).toFixed(2));
      await form.getByRole("button", { name: "Save changes" }).click();
      await expect(form).not.toBeVisible();
    });

    await test.step("Then the change is reflected on /seller/artworks and in the DB", async () => {
      await page.reload();
      const row = page.locator("tr", { hasText: newTitle });
      await expect(row).toBeVisible();
      await expect(row.getByText("$2750.00")).toBeVisible();

      const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: loggedInSeller.artwork.id } });
      expect(fresh.title).toBe(newTitle);
      expect(fresh.priceCents).toBe(newPriceCents);
    });
  });

  test("a SOLD listing offers no delete action on /seller/artworks, unlike an AVAILABLE one", async ({ page }) => {
    const seller = await createSellerFixture({ artworkInventoryState: "SOLD" });

    try {
      await test.step("Given a seller with an artwork that's SOLD", async () => {
        const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: seller.artwork.id } });
        expect(fresh.inventoryState).toBe("SOLD");
      });

      await test.step("When they view /seller/artworks", async () => {
        await page.context().addCookies([seller.sessionCookie]);
        await page.goto("/seller/artworks");
      });

      await test.step("Then the UI offers no delete (or any other) action for it — it shows an em dash instead", async () => {
        const row = page.locator("tr", { hasText: seller.artwork.title });
        await expect(row).toBeVisible();
        await expect(row.getByText("SOLD")).toBeVisible();
        await expect(row.getByText("Delete")).toHaveCount(0);
        await expect(row.getByText("Edit")).toHaveCount(0);
        await expect(row.getByText("—")).toBeVisible();
      });

      await test.step("And the underlying API also refuses to edit or delete it", async () => {
        const patchResponse = await page.request.patch(`/api/seller/artworks/${seller.artwork.id}`, {
          data: {
            title: "Should not apply",
            kind: seller.artwork.kind,
            priceCents: seller.artwork.priceCents,
            imageUrl: seller.artwork.imageUrl,
            altText: seller.artwork.altText,
          },
        });
        expect(patchResponse.status()).toBe(409);

        const deleteResponse = await page.request.delete(`/api/seller/artworks/${seller.artwork.id}`);
        expect(deleteResponse.status()).toBe(409);

        const fresh = await prisma.artwork.findUniqueOrThrow({ where: { id: seller.artwork.id } });
        expect(fresh.title).toBe(seller.artwork.title);
      });
    } finally {
      await seller.cleanup();
    }
  });
});
