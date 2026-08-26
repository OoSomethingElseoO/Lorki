import { defineConfig, devices } from "@playwright/test";

// Every process invocation of `npx playwright test` (i.e. every
// `npm run test:e2e`) gets its own synthetic x-forwarded-for so repeated
// runs — during iteration, or stacked back-to-back — never collide with
// each other, or with any other traffic that has no real reverse proxy in
// front of it (getRequestIp falls back to "unknown" with nothing set —
// see lib/rate-limit.ts), against the rate-limited /api/login (5/5min)
// and /api/inquiries (5/5min) routes. A real reverse proxy in front of
// production assigns a distinct x-forwarded-for per real visitor; this
// reproduces that for test traffic instead of every run sharing one
// "unknown" bucket that never has room to breathe.
function randomOctet() {
  return Math.floor(Math.random() * 254) + 1;
}
const TEST_RUN_IP = `10.${randomOctet()}.${randomOctet()}.${randomOctet()}`;

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
    extraHTTPHeaders: { "x-forwarded-for": TEST_RUN_IP },
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
