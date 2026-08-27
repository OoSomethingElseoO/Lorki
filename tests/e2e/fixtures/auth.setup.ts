// Playwright "setup" project (see playwright.config.ts `projects`) — runs
// once before the real test projects, logs in as the seeded admin
// (prisma/seed.ts / .env ADMIN_EMAIL+ADMIN_PASSWORD) through the actual
// /login form, and saves the resulting session cookie to disk. Any spec
// that needs an authenticated admin does `test.use({ storageState: authFile })`
// instead of logging in itself — one real login for the whole suite run
// instead of one per test, which matters here because /api/login is rate
// limited (5 attempts / 5 minutes / IP, see lib/rate-limit.ts).
import { test as setup } from "@playwright/test";
import { ADMIN_STORAGE_STATE } from "./auth-storage";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./db";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // LoginForm redirects an admin straight to /admin on success now (see
  // lib/post-login-redirect.ts) — the clearest signal the session cookie
  // actually got issued. Was "**/account" before that redirect existed,
  // when every login landed there regardless of role.
  await page.waitForURL("**/admin/**");

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
