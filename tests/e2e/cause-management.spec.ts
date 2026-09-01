// Covers cause self-management end to end against the real running app:
// /cause/profile (CauseSettingsPanel -> CauseProfileForm ->
// /api/cause/profile), including the reverification business logic in
// that route's `needsReverification` check — worth real UI-level coverage
// (not just the unit-test layer covering the route handler directly) since
// it's exercised through the actual "Save profile" button a cause rep would
// click, not a hand-built request body. (Profile and payout settings save
// independently now — see CauseSettingsPanel — so this suite only ever
// clicks the Profile tab's own save action.)
//
// Every scenario runs as a `loggedInCause` (tests/e2e/fixtures/db.ts's
// createCauseAccountFixture: a real User+session cookie linked to a
// Conservancy) and cleans up via that fixture's own cleanup(), or via
// createCauseAccountFixture directly (same pattern admin-crud.spec.ts uses
// for createConservancyFixture({ verified: true })) for the verified
// starting state.
import { createCauseAccountFixture, expect, prisma, test } from "./fixtures/test-fixtures";

test.describe("Cause profile", () => {
  test("updating non-identity fields on an unverified cause leaves it unverified", async ({
    page,
    loggedInCause,
  }) => {
    const newMission = "Updated throwaway mission from the Playwright E2E suite.";
    const newWebsite = "https://example.com/updated";

    await test.step("Given a logged-in cause representative on an unverified conservancy", async () => {
      const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: loggedInCause.conservancy.id } });
      expect(fresh.verifiedAt).toBeNull();

      await page.goto("/cause/profile");
      await expect(page.getByRole("heading", { name: "Your Cause" })).toBeVisible();
      await expect(page.getByText("Not verified yet")).toBeVisible();
    });

    await test.step("When they update non-identity fields (mission, website) and save", async () => {
      // The profile form lives behind the page's own "Manage your cause"
      // tab — "Campaigns" is shown by default.
      await page.getByRole("tab", { name: "Manage your cause" }).click();
      await page.getByLabel("Mission").fill(newMission);
      await page.getByLabel("Website").fill(newWebsite);
      await page.getByRole("button", { name: "Save profile" }).click();
      await expect(page.getByText("Organization details saved.")).toBeVisible();
    });

    await test.step("Then it stays unverified — no unexpected side effect", async () => {
      await page.reload();
      await expect(page.getByLabel("Mission")).toHaveValue(newMission);
      await expect(page.getByLabel("Website")).toHaveValue(newWebsite);
      await expect(page.getByText("Not verified yet")).toBeVisible();

      const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: loggedInCause.conservancy.id } });
      expect(fresh.mission).toBe(newMission);
      expect(fresh.website).toBe(newWebsite);
      expect(fresh.verifiedAt).toBeNull();
    });
  });

  test("changing the organization name on a VERIFIED cause reverts it to unverified", async ({ page }) => {
    const cause = await createCauseAccountFixture({ verified: true });
    const newName = `E2E Renamed Conservancy ${cause.tag}`;

    try {
      await test.step("Given a VERIFIED conservancy", async () => {
        const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: cause.conservancy.id } });
        expect(fresh.verifiedAt).not.toBeNull();

        await page.context().addCookies([cause.sessionCookie]);
        await page.goto("/cause/profile");
        await expect(page.getByText(/^Verified on/)).toBeVisible();
      });

      await test.step("When they change the organization's name and save", async () => {
        // The profile form lives behind the page's own "Manage your cause"
        // tab — "Campaigns" is shown by default.
        await page.getByRole("tab", { name: "Manage your cause" }).click();
        await page.getByLabel("Organization name").fill(newName);
        await page.getByRole("button", { name: "Save profile" }).click();
        await expect(page.getByText("Organization details saved.")).toBeVisible();
      });

      await test.step("Then verifiedAt reverts to null and the UI reflects the unverified state", async () => {
        await expect
          .poll(async () => {
            const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: cause.conservancy.id } });
            return fresh.verifiedAt;
          })
          .toBeNull();

        const fresh = await prisma.conservancy.findUniqueOrThrow({ where: { id: cause.conservancy.id } });
        expect(fresh.name).toBe(newName);

        await page.reload();
        await expect(page.getByText("Not verified yet")).toBeVisible();
      });
    } finally {
      await cause.cleanup();
    }
  });
});
