import { defineConfig, devices } from "@playwright/test";

// First-class Playwright E2E suite for this app — see tests/e2e/. Talks to
// the real running Next.js app over HTTP and the real local dev Postgres
// (DATABASE_URL from .env) via Prisma, never a mock. NEVER point this at
// production — baseURL below is hardcoded to localhost on purpose.
//
// `webServer` below reuses an already-running `npm run dev` (verified: it
// polls baseURL first and only spawns a new process if nothing answers),
// so `npm run test:e2e` works whether or not you already have the dev
// server up in another terminal.
export default defineConfig({
  testDir: "./tests/e2e",

  // Serial, single worker: the reservation and payout scenarios seed and
  // mutate real DB rows (throwaway ones, always cleaned up — see
  // tests/e2e/fixtures/db.ts) and the inquiry/login endpoints are IP rate
  // limited (see lib/rate-limit.ts). Parallel workers would all share one
  // IP against one dev server, which is a recipe for exactly the kind of
  // cross-test flakiness this suite exists to avoid.
  fullyParallel: false,
  workers: 1,
  retries: 0,

  reporter: "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },

  projects: [
    // Logs in once as the seeded admin and saves the session cookie to
    // tests/e2e/.auth/admin.json — see auth.setup.ts. Specs that need an
    // authenticated admin load that file via test.use({ storageState }).
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
  ],
});
