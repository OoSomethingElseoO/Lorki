// Covers account creation and the two profile-onboarding flows built on
// top of it, end to end against the real running app: app/api/signup,
// app/api/login, app/api/artist/onboarding, app/api/cause/onboarding, and
// their real form pages/components.
//
// /api/signup and /api/login are IP rate limited (5 attempts/5min — see
// lib/rate-limit.ts), same as /api/inquiries. Every scenario below that
// needs "an account already exists" as a PRECONDITION (not the thing under
// test) seeds that account directly via the `loggedInUser` fixture or
// `createUserFixture` (tests/e2e/fixtures/db.ts) instead of driving a real
// signup/login through the UI for setup — only the scenarios actually
// testing signup or login spend a real attempt against those routes. Total
// across this file: 2 real /api/signup calls, 2 real /api/login calls,
// well under the 5/5min budget shared with auth.setup.ts's one admin login
// for the whole process run.
import {
  cleanupUserByEmail,
  createUserFixture,
  expect,
  prisma,
  test,
  testEmail,
} from "./fixtures/test-fixtures";

test.describe("Signup", () => {
  test("a fresh visitor signs up through the real form and lands on a logged-in /account with a User row created", async ({
    page,
  }) => {
    const email = testEmail("signup");

    try {
      await test.step("Given a fresh visitor on /signup", async () => {
        await page.goto("/signup");
      });

      await test.step("When they sign up with a valid name/email/password", async () => {
        await page.getByLabel("Name (optional)").fill("E2E Signup Visitor");
        await page.getByLabel("Email").fill(email);
        await page.getByLabel("Password").fill("correct-horse-battery-1");
        await page.getByRole("button", { name: "Create account" }).click();
      });

      await test.step("Then they land on a logged-in /account and a User row exists", async () => {
        await page.waitForURL("**/account");
        await expect(page.getByText("Signed in as")).toBeVisible();

        const user = await prisma.user.findUnique({ where: { email } });
        expect(user).not.toBeNull();
        expect(user?.name).toBe("E2E Signup Visitor");
      });
    } finally {
      await cleanupUserByEmail(email);
    }
  });

  test("signing up with an already-registered email shows an error and creates no duplicate row", async ({ page }) => {
    const existing = await createUserFixture();

    try {
      await test.step("Given an existing account's email", async () => {
        const user = await prisma.user.findUniqueOrThrow({ where: { email: existing.email } });
        expect(user).not.toBeNull();
      });

      await test.step("When someone tries to sign up again with that email", async () => {
        await page.goto("/signup");
        await page.getByLabel("Email").fill(existing.email);
        await page.getByLabel("Password").fill("a-different-password-1");
        await page.getByRole("button", { name: "Create account" }).click();
      });

      await test.step("Then the form shows an error and no duplicate row is created", async () => {
        await expect(page.getByText("An account with this email already exists")).toBeVisible();

        const count = await prisma.user.count({ where: { email: existing.email } });
        expect(count).toBe(1);
      });
    } finally {
      await existing.cleanup();
    }
  });
});

test.describe("Login", () => {
  test("valid credentials log a user in and land them on a logged-in page", async ({ page }) => {
    const seeded = await createUserFixture();

    try {
      await test.step("Given valid login credentials for a user account", async () => {
        const user = await prisma.user.findUniqueOrThrow({ where: { email: seeded.email } });
        expect(user).not.toBeNull();
      });

      await test.step("When they log in through /login", async () => {
        await page.goto("/login");
        await page.getByLabel("Email").fill(seeded.email);
        await page.getByLabel("Password").fill(seeded.password);
        await page.getByRole("button", { name: "Sign in" }).click();
      });

      await test.step("Then they land on a logged-in page", async () => {
        await page.waitForURL("**/account");
        await expect(page.getByText("Signed in as")).toBeVisible();
      });
    } finally {
      await seeded.cleanup();
    }
  });

  test("wrong credentials show an error and no session is created", async ({ page }) => {
    const seeded = await createUserFixture();

    try {
      await test.step("Given an account exists but the visitor has the wrong password", async () => {
        const user = await prisma.user.findUniqueOrThrow({ where: { email: seeded.email } });
        expect(user).not.toBeNull();
      });

      await test.step("When they try to log in with the wrong password", async () => {
        await page.goto("/login");
        await page.getByLabel("Email").fill(seeded.email);
        await page.getByLabel("Password").fill("definitely-the-wrong-password");
        await page.getByRole("button", { name: "Sign in" }).click();
      });

      await test.step("Then an error shows and no session is created", async () => {
        await expect(page.getByText("Incorrect email or password")).toBeVisible();
        await expect(page).toHaveURL(/\/login/);

        const cookies = await page.context().cookies();
        expect(cookies.find((cookie) => cookie.name === "lorki_session")).toBeUndefined();
      });
    } finally {
      await seeded.cleanup();
    }
  });
});

test.describe("Artist onboarding", () => {
  test("a logged-in user with no Artist yet completes /artist/onboarding and becomes an artist", async ({
    page,
    loggedInUser,
  }) => {
    await test.step("Given a logged-in user with no Artist yet", async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: loggedInUser.user.id },
        include: { artist: true },
      });
      expect(user.artist).toBeNull();
    });

    const artistName = `E2E Onboarded Artist ${loggedInUser.tag}`;

    await test.step("When they complete /artist/onboarding through the real form", async () => {
      await page.goto("/artist/onboarding");
      await page.getByLabel("Artist name").fill(artistName);
      await page.getByLabel("Country").fill("Kenya");
      await page.getByLabel("Bio").fill("Throwaway artist bio created by the Playwright E2E suite.");
      await page.getByLabel("Portrait").fill("https://example.com/artist.jpg");
      await page.getByRole("button", { name: "Start selling" }).click();
    });

    await test.step("Then they land on the artist dashboard and an Artist row exists linked to their user", async () => {
      await page.waitForURL("**/artist");
      await expect(page.getByRole("heading", { name: "Artist Dashboard" })).toBeVisible();

      const artist = await prisma.artist.findUniqueOrThrow({ where: { userId: loggedInUser.user.id } });
      expect(artist.name).toBe(artistName);
    });
  });
});

test.describe("Cause onboarding", () => {
  test("a logged-in user with no Conservancy yet completes /cause/onboarding and it's created unverified", async ({
    page,
    loggedInUser,
  }) => {
    await test.step("Given a logged-in user with no Conservancy yet", async () => {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: loggedInUser.user.id },
        include: { conservancy: true },
      });
      expect(user.conservancy).toBeNull();
    });

    const causeName = `E2E Onboarded Cause ${loggedInUser.tag}`;

    await test.step("When they complete /cause/onboarding through the real form", async () => {
      await page.goto("/cause/onboarding");
      await page.getByLabel("Organization name").fill(causeName);
      await page.getByLabel("Region").fill("Test Region");
      await page.getByLabel("Mission").fill("Throwaway cause mission created by the Playwright E2E suite.");
      await page.getByLabel("Website").fill("https://example.com");
      await page.getByLabel("Contact email").fill(`${loggedInUser.tag}-cause@e2e.test`);
      await page.getByLabel("Registration number").fill(`REG-${loggedInUser.tag}`);
      await page.getByRole("button", { name: "Register cause" }).click();
    });

    await test.step("Then a Conservancy row exists linked to their user, unverified", async () => {
      await page.waitForURL("**/cause/profile");

      const conservancy = await prisma.conservancy.findUniqueOrThrow({ where: { userId: loggedInUser.user.id } });
      expect(conservancy.name).toBe(causeName);
      expect(conservancy.verifiedAt).toBeNull();
    });
  });
});
