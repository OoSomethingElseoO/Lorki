// Covers admin CRUD for three of the 8 admin entity types — conservancies
// (the richest lifecycle: create -> appears in list -> verify checklist),
// animals (a real cross-entity validation: requires an existing
// conservancy), and news (its own DRAFT/LIVE status toggle) — end to end
// against the real running app: the /admin/conservancies, /admin/animals,
// and /admin/news pages and their API routes.
//
// Every scenario runs as the seeded admin (ADMIN_STORAGE_STATE, logged in
// once by auth.setup.ts) and cleans up exactly the rows it created,
// directly via Prisma (mirroring createOriginalArtworkFixture/
// createFailedPayoutFixture's own cleanup() pattern in fixtures/db.ts),
// since most of what's created here comes from the real admin UI form
// rather than a fixture builder, so there's no fixture to hold the
// resulting id for us.
import { ADMIN_STORAGE_STATE } from "./fixtures/auth-storage";
import { createConservancyFixture, expect, prisma, test, testTag } from "./fixtures/test-fixtures";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin CRUD: conservancies", () => {
  test("admin creates a new conservancy via the form; it appears in the table and a row exists in the DB", async ({
    page,
  }) => {
    const tag = testTag("admin-conservancy");
    const name = `E2E Admin Conservancy ${tag}`;
    let conservancyId: string | undefined;

    try {
      await test.step("Given an admin logged in on /admin/conservancies", async () => {
        await page.goto("/admin/conservancies");
      });

      await test.step("When they create a new conservancy via the form", async () => {
        // Scoped to the create form itself (class "admin-form"), not just
        // the page — the AdminSearchForm's search box just below it has an
        // aria-label ("Search by name, region, or contact email") whose
        // words overlap "Name"/"Region"/"Contact email" enough that a
        // page-wide getByLabel is ambiguous.
        const form = page.locator("form.admin-form");
        await form.getByLabel("Name").fill(name);
        await form.getByLabel("Region").fill("Test Region");
        await form.getByLabel("Mission").fill("Throwaway mission created by the Playwright E2E suite.");
        await form.getByLabel("Website").fill("https://example.com");
        await form.getByLabel("Contact email").fill(`${tag}@e2e.test`);
        await page.getByRole("button", { name: "Add conservancy" }).click();
      });

      // Admin-created conservancies are auto-verified AT CREATION — see
      // /api/admin/conservancies/route.ts's own comment: "an admin
      // entering this by hand already is the vetting" — unlike a
      // self-registered cause via /cause/onboarding, which starts
      // unverified. So this deliberately asserts Verified, not unverified;
      // the unverified starting state is covered by the next scenario
      // below, which seeds a conservancy the same way self-registration
      // does.
      await test.step("Then it appears in the table already Verified, and a row exists in the DB", async () => {
        const row = page.locator("tr", { hasText: name });
        await expect(row).toBeVisible();
        await expect(row.getByText(/Verified/)).toBeVisible();

        const fresh = await prisma.conservancy.findFirstOrThrow({ where: { name } });
        conservancyId = fresh.id;
        expect(fresh.verifiedAt).not.toBeNull();
      });
    } finally {
      if (conservancyId) {
        await prisma.conservancy.delete({ where: { id: conservancyId } }).catch(() => {});
      }
    }
  });

  test("admin completes the verify checklist on an unverified conservancy and it shows Verified", async ({
    page,
    unverifiedConservancy,
  }) => {
    await test.step("Given an unverified conservancy (self-registered style)", async () => {
      const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: unverifiedConservancy.conservancy.id } });
      expect(fresh.verifiedAt).toBeNull();

      await page.goto(`/admin/conservancies?q=${encodeURIComponent(unverifiedConservancy.conservancy.name)}`);
      await expect(page.getByText(unverifiedConservancy.conservancy.name)).toBeVisible();
    });

    // The checklist requires all 3 items confirmed plus a non-empty
    // "how was it checked" method (see verify-conservancy-button.tsx's
    // `allChecked` and the route's own validation) before Verify enables.
    await test.step("When the admin completes the verify checklist", async () => {
      await page.getByRole("button", { name: "Review & verify" }).click();

      const dialog = page.getByRole("dialog");
      await dialog.getByRole("checkbox", { name: /checks out/ }).check();
      await dialog.getByLabel(/How was it actually checked/).fill("Confirmed via a direct phone call to the registry.");
      await dialog.getByRole("checkbox", { name: /sanctions list/ }).check();
      await dialog.getByRole("checkbox", { name: /Payout account holder name/ }).check();
      await dialog.getByRole("button", { name: "Verify", exact: true }).click();
    });

    await test.step('Then it shows "Verified" in the table', async () => {
      const row = page.locator("tr", { hasText: unverifiedConservancy.conservancy.name });
      await expect(row.getByText(/Verified/)).toBeVisible();

      await expect
        .poll(async () => {
          const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: unverifiedConservancy.conservancy.id } });
          return fresh.verifiedAt;
        })
        .not.toBeNull();
    });
  });
});

test.describe("Admin CRUD: animals", () => {
  test("admin creates a new animal via /admin/animals referencing an existing conservancy; it appears linked to it", async ({
    page,
  }) => {
    const conservancyFixture = await createConservancyFixture({ verified: true });
    const tag = testTag("admin-animal");
    const name = `Lorkulup ${tag}`;
    let animalId: string | undefined;

    try {
      await test.step("Given at least one existing conservancy", async () => {
        const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: conservancyFixture.conservancy.id } });
        expect(fresh).not.toBeNull();
      });

      await test.step("When the admin creates a new animal via /admin/animals referencing it", async () => {
        await page.goto("/admin/animals");
        // Scoped to the create form — the search box's aria-label ("Search
        // by name, species, or region") overlaps "Name"/"Species"/"Region"
        // enough to make a page-wide getByLabel ambiguous.
        const form = page.locator("form.admin-form");
        await form.getByLabel("Name").fill(name);
        await form.getByLabel("Species").fill("Lion");
        await form.getByLabel("Region").fill("Test Region");
        await form.getByLabel("Story").fill("Throwaway animal story created by the Playwright E2E suite.");
        await form.getByLabel("Image").fill("https://example.com/animal.jpg");
        await form.getByLabel("Conservancy").selectOption({ label: conservancyFixture.conservancy.name });
        await page.getByRole("button", { name: "Add animal" }).click();
      });

      await test.step("Then the animal appears in the list linked to that conservancy", async () => {
        const row = page.locator("tr", { hasText: name });
        await expect(row).toBeVisible();
        await expect(row.getByText(conservancyFixture.conservancy.name)).toBeVisible();

        const fresh = await prisma.animal.findFirstOrThrow({ where: { name } });
        animalId = fresh.id;
        expect(fresh.conservancyId).toBe(conservancyFixture.conservancy.id);
      });
    } finally {
      if (animalId) {
        await prisma.animal.delete({ where: { id: animalId } }).catch(() => {});
      }
      await conservancyFixture.cleanup();
    }
  });
});

test.describe("Admin CRUD: news", () => {
  test("a news article starts DRAFT (hidden from /news), and flipping it to LIVE makes it visible there", async ({
    page,
  }) => {
    const tag = testTag("admin-news");
    const title = `E2E News Article ${tag}`;
    let articleId: string | undefined;

    try {
      await test.step("Given an admin creates a news article via /admin/news", async () => {
        await page.goto("/admin/news");
        // Scoped to the create form — the search box's aria-label ("Search
        // by title or summary") overlaps "Title"/"Summary" enough to make
        // a page-wide getByLabel ambiguous.
        const form = page.locator("form.admin-form");
        await form.getByLabel("Title").fill(title);
        await form.getByLabel("Summary").fill("Throwaway news summary created by the Playwright E2E suite.");
        await form.getByLabel("Body").fill("Throwaway news body created by the Playwright E2E suite.");
        await form.getByLabel("Image").fill("https://example.com/news.jpg");
        await page.getByRole("button", { name: "Add article" }).click();
      });

      await test.step("Then it starts DRAFT and is not visible on the public /news page", async () => {
        const row = page.locator("tr", { hasText: title });
        await expect(row).toBeVisible();
        await expect(row.locator("select")).toHaveValue("DRAFT");

        const fresh = await prisma.newsArticle.findFirstOrThrow({ where: { title } });
        articleId = fresh.id;
        expect(fresh.status).toBe("DRAFT");

        await page.goto("/news");
        await expect(page.getByText(title)).not.toBeVisible();
      });

      await test.step("When the admin flips its status control to LIVE", async () => {
        await page.goto("/admin/news");
        const row = page.locator("tr", { hasText: title });
        await row.locator("select").selectOption("LIVE");
        await expect(page.getByText("Status updated to LIVE")).toBeVisible();
      });

      await test.step("Then it becomes visible on /news", async () => {
        await expect
          .poll(async () => {
            const fresh = await prisma.newsArticle.findUniqueOrThrow({ where: { id: articleId! } });
            return fresh.status;
          })
          .toBe("LIVE");

        await page.goto("/news");
        await expect(page.getByText(title)).toBeVisible();
      });
    } finally {
      if (articleId) {
        await prisma.newsArticle.delete({ where: { id: articleId } }).catch(() => {});
      }
    }
  });
});
