// Covers the remaining admin CRUD surfaces not already exercised by
// admin-crud.spec.ts (conservancies/animals/news): artists (/admin/artists),
// campaign edits (/admin/campaigns/[id]/edit), and admin users
// (/admin/users) — end to end against the real running app. Not
// exhaustive of every admin page (settings, users-listing pagination,
// etc.) — see the task brief's own "2-3 well-covered scenarios" guidance.
//
// Every scenario runs as the seeded admin (ADMIN_STORAGE_STATE, logged in
// once by auth.setup.ts) and cleans up exactly the rows it created,
// directly via Prisma, same pattern as admin-crud.spec.ts.
import { ADMIN_STORAGE_STATE } from "./fixtures/auth-storage";
import { expect, prisma, test, testTag } from "./fixtures/test-fixtures";

test.use({ storageState: ADMIN_STORAGE_STATE });

test.describe("Admin CRUD: artists", () => {
  test("admin creates a new artist via the form; it appears in the list and a row exists in the DB", async ({
    page,
  }) => {
    const tag = testTag("admin-artist");
    const name = `E2E Admin Artist ${tag}`;
    let artistId: string | undefined;

    try {
      await test.step("Given an admin on /admin/artists", async () => {
        await page.goto("/admin/artists");
      });

      await test.step("When they create a new artist via the form", async () => {
        // Scoped to the create form itself — the AdminSearchForm just below
        // it has an aria-label ("Search by name or country") that overlaps
        // "Name"/"Country" enough to make a page-wide getByLabel ambiguous,
        // same reasoning admin-crud.spec.ts documents for its own forms.
        const form = page.locator("form.admin-form");
        await form.getByLabel("Name").fill(name);
        await form.getByLabel("Country").fill("Kenya");
        await form.getByLabel("Bio").fill("Throwaway artist bio created by the Playwright E2E suite.");
        await form.getByLabel("Image").fill("https://example.com/artist.jpg");
        await page.getByRole("button", { name: "Add artist" }).click();
      });

      await test.step("Then it appears in the table and a row exists in the DB", async () => {
        const row = page.locator("tr", { hasText: name });
        await expect(row).toBeVisible();
        await expect(row.getByText("Kenya")).toBeVisible();

        const fresh = await prisma.artist.findFirstOrThrow({ where: { name } });
        artistId = fresh.id;
        expect(fresh.country).toBe("Kenya");
      });
    } finally {
      if (artistId) {
        await prisma.artist.delete({ where: { id: artistId } }).catch(() => {});
      }
    }
  });
});

test.describe("Admin CRUD: campaign edits", () => {
  test("admin edits an existing campaign's split percentages via /admin/campaigns/[id]/edit; the change persists", async ({
    page,
    originalArtwork,
  }) => {
    const { campaign } = originalArtwork;

    await test.step("Given an existing campaign with its original 50/25/25 split", async () => {
      const fresh = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      expect(fresh.artistPercent).toBe(50);
      expect(fresh.conservancyPercent).toBe(25);
      expect(fresh.operationsPercent).toBe(25);

      await page.goto(`/admin/campaigns/${campaign.id}/edit`);
    });

    // The edit page's CampaignForm has no status control at all (status is
    // only editable from the /admin/campaigns list via
    // CampaignStatusControl) — split percentages are what's actually
    // editable here, per the task brief's own fallback.
    await test.step("When the admin changes the split percentages and saves", async () => {
      await page.getByLabel("Artist %").fill("40");
      await page.getByLabel("Conservancy %").fill("35");
      await page.getByLabel("Operations %").fill("25");
      await page.getByRole("button", { name: "Save changes" }).click();
      // The form navigates to /admin/campaigns on success (router.push),
      // the clearest signal the PATCH actually succeeded.
      await page.waitForURL("**/admin/campaigns");
    });

    await test.step("Then the new split persists in the DB and shows on the campaigns list", async () => {
      const fresh = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
      expect(fresh.artistPercent).toBe(40);
      expect(fresh.conservancyPercent).toBe(35);
      expect(fresh.operationsPercent).toBe(25);

      // Scoped to this campaign's own card (identified by its unique
      // throwaway conservancy name) rather than a page-wide text search —
      // /admin/campaigns lists every campaign in the DB, and nothing rules
      // out another one coincidentally sharing this split percentage.
      const card = page.locator("section.admin-campaign-card", { hasText: originalArtwork.conservancy.name });
      await expect(card.getByText("Split: 40% artist / 35% conservancy / 25% operations")).toBeVisible();
    });
  });
});

test.describe("Admin CRUD: users", () => {
  test("admin creates a new admin user via /admin/users; it appears in the list and the account can log in", async ({
    page,
  }) => {
    const tag = testTag("admin-user");
    const name = `E2E Admin User ${tag}`;
    const email = `${tag}@e2e.test`;
    const password = "e2e-test-password-1";
    let userId: string | undefined;

    try {
      await test.step("Given an admin on /admin/users", async () => {
        await page.goto("/admin/users");
      });

      await test.step("When they create a new admin user via the form", async () => {
        const form = page.locator("form.admin-form");
        await form.getByLabel("Name").fill(name);
        await form.getByLabel("Email").fill(email);
        await form.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Add admin" }).click();
      });

      await test.step("Then it appears in the list and a row exists in the DB", async () => {
        const row = page.locator("tr", { hasText: email });
        await expect(row).toBeVisible();

        const fresh = await prisma.user.findUniqueOrThrow({ where: { email } });
        userId = fresh.id;
        expect(fresh.isAdmin).toBe(true);
      });

      await test.step("And the created account can actually log in", async () => {
        // Reuses this same page/context rather than opening a new one —
        // by this point every admin-only action above is already done, so
        // overwriting the session cookie with the new account's is safe
        // and doesn't touch the on-disk ADMIN_STORAGE_STATE file other
        // tests load fresh per-test.
        await page.goto("/login");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill(password);
        await page.getByRole("button", { name: "Sign in" }).click();

        // An admin now lands straight on /admin (see
        // lib/post-login-redirect.ts), not the generic /account hub — and
        // reaching it at all is a stronger proof of a genuinely working
        // admin account than the old "Signed in as" check on /account
        // ever was: proxy.ts's middleware would redirect a non-admin away
        // from /admin before this URL ever resolved.
        await page.waitForURL("**/admin/**");
        await expect(page.getByText("Lorkulup Admin")).toBeVisible();
      });
    } finally {
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
    }
  });
});
