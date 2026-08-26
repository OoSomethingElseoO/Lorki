// Playwright fixture wiring: turns the raw Prisma builders in db.ts into
// auto-cleaning `test` fixtures. Each fixture's teardown runs after every
// test that uses it — including a failed one — so no test has to remember
// to clean up by hand.
import { test as base, expect } from "@playwright/test";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  cleanupUserByEmail,
  createArtistFixture,
  createConservancyFixture,
  createFailedPayoutFixture,
  createOriginalArtworkFixture,
  createUserFixture,
  prisma,
  testEmail,
  testTag,
} from "./db";

type OriginalArtworkFixture = Awaited<ReturnType<typeof createOriginalArtworkFixture>>;
type FailedPayoutFixture = Awaited<ReturnType<typeof createFailedPayoutFixture>>;
type UserFixture = Awaited<ReturnType<typeof createUserFixture>>;
type ConservancyFixture = Awaited<ReturnType<typeof createConservancyFixture>>;

type Fixtures = {
  // An ORIGINAL artwork on a LIVE campaign, AVAILABLE, with nothing else
  // attached — the starting state for "an inquiry reserves it" scenarios.
  originalArtwork: OriginalArtworkFixture;
  // Same, but already RESERVED with a NEW inquiry from a "first visitor" —
  // the starting state for "a second inquiry is rejected" and "an admin
  // closes the inquiry" scenarios.
  reservedArtwork: OriginalArtworkFixture;
  // An Order + Payout chain with the Payout already FAILED — the starting
  // state for every Revive scenario.
  failedPayout: FailedPayoutFixture;
  // A plain User, already "logged in" — its real session cookie
  // (createUserFixture) is injected into this test's browser context
  // before the test body runs, so onboarding scenarios that need "a
  // logged-in user with no Artist/Conservancy yet" as a precondition don't
  // have to spend a real /api/login attempt just to get there.
  loggedInUser: UserFixture;
  // A Conservancy seeded unverified (verifiedAt: null), mirroring a
  // self-registered cause — the starting state for the admin
  // verify-checklist scenario in admin-crud.spec.ts.
  unverifiedConservancy: ConservancyFixture;
};

export const test = base.extend<Fixtures>({
  originalArtwork: async ({}, use) => {
    const fixture = await createOriginalArtworkFixture();
    await use(fixture);
    await fixture.cleanup();
  },

  reservedArtwork: async ({}, use) => {
    const fixture = await createOriginalArtworkFixture({
      inventoryState: "RESERVED",
      reservedAt: new Date(),
      withInquiry: {
        name: "First Visitor",
        email: `first-visitor-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@e2e.test`,
        status: "NEW",
      },
    });
    await use(fixture);
    await fixture.cleanup();
  },

  failedPayout: async ({}, use) => {
    const fixture = await createFailedPayoutFixture();
    await use(fixture);
    await fixture.cleanup();
  },

  loggedInUser: async ({ context }, use) => {
    const fixture = await createUserFixture();
    await context.addCookies([fixture.sessionCookie]);
    await use(fixture);
    await fixture.cleanup();
  },

  unverifiedConservancy: async ({}, use) => {
    const fixture = await createConservancyFixture();
    await use(fixture);
    await fixture.cleanup();
  },
});

export {
  expect,
  prisma,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  cleanupUserByEmail,
  createArtistFixture,
  createConservancyFixture,
  createUserFixture,
  testEmail,
  testTag,
};
