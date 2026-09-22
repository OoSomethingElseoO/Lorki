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
import { ADMIN_EMAIL, ADMIN_PASSWORD, prisma } from "./db";
import { hashPassword } from "../../../lib/password";

setup("authenticate as admin", async ({ page }) => {
  // Keep the local E2E account deterministic. A developer database may have
  // an older admin password (or no seeded admin at all), which otherwise
  // turns every protected browser test into a misleading login timeout.
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, isAdmin: true, name: "E2E Admin" },
    create: { email: ADMIN_EMAIL, passwordHash, isAdmin: true, name: "E2E Admin" },
  });

  await page.goto("/login");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  // Exact match: PasswordInput's show/hide toggle button carries its own
  // aria-label ("Show password"/"Hide password"), which a non-exact
  // getByLabel("Password") also matches as a substring, breaking strict
  // mode with two results.
  await page.getByLabel("Password", { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  // LoginForm redirects an admin straight to /admin on success now (see
  // lib/post-login-redirect.ts) — the clearest signal the session cookie
  // actually got issued. Was "**/account" before that redirect existed,
  // when every login landed there regardless of role.
  // `/admin` is the canonical admin landing URL; a glob ending in `/**`
  // does not match the bare path and caused false login timeouts.
  await page.waitForURL(/\/admin(?:\/|$)/);

  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
  await prisma.$disconnect();
});
