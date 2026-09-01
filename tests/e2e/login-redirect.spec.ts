// Covers resolvePostLoginRedirect (lib/post-login-redirect.ts) end to end
// through the real /login form: every login used to land on /account
// regardless of role (an admin saw a consumer "Are you an artist?" page
// before ever reaching the admin tool; an artist- or cause-only user
// always needed one extra click past a generic hub). This confirms the
// real destination for each role combination, not just the pure
// function's own logic (lib/__tests__/post-login-redirect.test.ts covers
// that in isolation).
import { hashPassword } from "@/lib/password";
import { ADMIN_EMAIL, ADMIN_PASSWORD, createCauseAccountFixture, createLoggedInArtistFixture, createUserFixture, expect, prisma, test } from "./fixtures/test-fixtures";

// This file alone performs 6 real /api/login POSTs across its tests, on
// top of the 1 the "setup" project already does to authenticate as admin
// — playwright.config.ts's shared TEST_RUN_IP (one synthetic IP per whole
// process run, meant to stop separate RUNS from colliding) was never
// meant to absorb that much real traffic to one 5-attempts/5-minute route
// within a SINGLE run. Each test here gets its own fresh synthetic IP
// instead, so this file's own login volume can't push the shared
// per-process budget over the limit — same reasoning as TEST_RUN_IP
// itself, just scoped to test instead of process.
function freshIp() {
  const octet = () => Math.floor(Math.random() * 254) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}

async function login(page: import("@playwright/test").Page, email: string, password: string) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshIp() });
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("Post-login redirect", () => {
  test("the seeded admin lands on /admin, not the generic account hub", async ({ page }) => {
    await test.step("When the admin logs in", async () => {
      await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    });

    await test.step("Then they land on /admin, not /account", async () => {
      await page.waitForURL("**/admin/**");
      await expect(page.getByText("Lorkulup Admin")).toBeVisible();
    });
  });

  test("an artist-only user lands straight on /artist", async ({ page }) => {
    const artist = await createLoggedInArtistFixture();
    try {
      await test.step("When an artist-only user logs in", async () => {
        await login(page, artist.email, artist.password);
      });

      await test.step("Then they land on /artist, not /account", async () => {
        await page.waitForURL("**/artist");
        await expect(page.getByRole("heading", { name: "Artist Dashboard" })).toBeVisible();
      });
    } finally {
      await artist.cleanup();
    }
  });

  test("a cause-only user lands straight on /cause/profile", async ({ page }) => {
    const cause = await createCauseAccountFixture();
    try {
      await test.step("When a cause-only user logs in", async () => {
        await login(page, cause.email, cause.password);
      });

      await test.step("Then they land on /cause/profile, not /account", async () => {
        await page.waitForURL("**/cause/profile");
        await expect(page.getByRole("heading", { name: "Your Cause" })).toBeVisible();
      });
    } finally {
      await cause.cleanup();
    }
  });

  test("a user with no roles falls back to /account", async ({ page }) => {
    const seeded = await createUserFixture();
    try {
      await test.step("When a plain customer logs in", async () => {
        await login(page, seeded.email, seeded.password);
      });

      await test.step("Then they land on /account", async () => {
        await page.waitForURL("**/account");
        await expect(page.getByText("Signed in as")).toBeVisible();
      });
    } finally {
      await seeded.cleanup();
    }
  });

  test("a dual-role user (artist AND cause rep) falls back to /account — no single unambiguous dashboard", async ({ page }) => {
    const email = `dual-role-${Date.now()}@e2e.test`;
    const password = "e2e-test-password-1";
    const user = await prisma.user.create({
      data: { email, passwordHash: await hashPassword(password), name: "E2E Dual Role User" },
    });
    const artist = await prisma.artist.create({
      data: {
        slug: `dual-role-artist-${Date.now()}`,
        name: "E2E Dual Role Artist",
        country: "Kenya",
        bio: "Throwaway artist for the dual-role redirect test.",
        imageUrl: "https://example.com/artist.jpg",
        userId: user.id,
      },
    });
    const conservancy = await prisma.conservancy.create({
      data: {
        name: "E2E Dual Role Conservancy",
        region: "Kenya",
        mission: "Throwaway conservancy for the dual-role redirect test.",
        website: "https://example.org",
        contactEmail: "contact@example.org",
        userId: user.id,
      },
    });

    try {
      await test.step("When a user who is both an artist and a cause rep logs in", async () => {
        await login(page, email, password);
      });

      await test.step("Then they land on /account, since neither dashboard is unambiguously the right one", async () => {
        await page.waitForURL("**/account");
        await expect(page.getByText("Signed in as")).toBeVisible();
      });
    } finally {
      await prisma.artist.delete({ where: { id: artist.id } }).catch(() => {});
      await prisma.conservancy.delete({ where: { id: conservancy.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    }
  });

  test("a next param is honored even for an admin", async ({ page }) => {
    await test.step("Given an admin was sent to /login with a ?next= param (e.g. via proxy.ts)", async () => {
      await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshIp() });
      await page.goto("/login?next=%2Fadmin%2Fusers");
    });

    await test.step("When they log in", async () => {
      await page.getByLabel("Email").fill(ADMIN_EMAIL);
      await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
      await page.getByRole("button", { name: "Sign in" }).click();
    });

    await test.step("Then they land on the exact next page, not the role-based default", async () => {
      await page.waitForURL("**/admin/users");
    });
  });
});
