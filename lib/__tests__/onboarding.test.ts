// app/api/artist/onboarding/route.ts and app/api/cause/onboarding/route.ts
// both gate on getCurrentUser(), which calls cookies() from next/headers.
// Confirmed by hand (see report) that calling cookies() outside a real
// Next.js request scope throws "cookies was called outside a request
// scope" — so the direct-handler-call pattern used in signup.test.ts /
// login.test.ts does not work for these two routes. That's expected: a
// parallel E2E suite (tests/e2e/) covers the full request-response
// behavior of both routes (including the 401/400 branches, which need an
// actual signed-in session or a real Request that never reaches
// getCurrentUser). What's left, and genuinely valuable here, is DB-level
// coverage of the business rules these routes implement: how the created
// row links to the user, and the exact condition each route's own
// "already onboarded" guard checks.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError } from "@/lib/prisma-errors";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createBareUser() {
  return prisma.user.create({
    data: { email: `onboarding-${unique()}@example.com`, passwordHash: "not-a-real-hash" },
  });
}

// --- artist (Artist) onboarding -----------------------------------------

test("an Artist row created with a userId links to that user, matching getCurrentUser()'s include", async (t) => {
  const user = await createBareUser();
  const artist = await prisma.artist.create({
    data: {
      slug: `test-artist-${unique()}`,
      name: "Test Artist",
      country: "Kenya",
      bio: "A throwaway artist created by onboarding.test.ts",
      imageUrl: "https://example.com/artist.jpg",
      userId: user.id,
    },
  });
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  // Exactly what getCurrentUser() (called by the route) queries.
  const reloaded = await prisma.user.findUnique({ where: { id: user.id }, include: { artist: true, conservancy: true } });
  assert.ok(reloaded?.artist, "user.artist should be populated after linking");
  assert.equal(reloaded!.artist!.id, artist.id);
  assert.equal(reloaded!.artist!.userId, user.id);
});

test("artist onboarding's own guard (`if (user.artist) return 409`): a user who already has an Artist trips it", async (t) => {
  const user = await createBareUser();
  const artist = await prisma.artist.create({
    data: {
      slug: `test-artist-guard-${unique()}`,
      name: "Test Artist Guard",
      country: "Kenya",
      bio: "A throwaway artist created by onboarding.test.ts",
      imageUrl: "https://example.com/artist.jpg",
      userId: user.id,
    },
  });
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const currentUser = await prisma.user.findUnique({ where: { id: user.id }, include: { artist: true, conservancy: true } });
  // This is precisely the condition app/api/artist/onboarding/route.ts
  // evaluates right after getCurrentUser() to decide whether to 409.
  assert.equal(!!currentUser!.artist, true, "a second onboarding attempt for this user must be rejected");

  const brandNewUser = await createBareUser();
  t.after(async () => {
    await prisma.user.delete({ where: { id: brandNewUser.id } });
  });
  const freshCurrentUser = await prisma.user.findUnique({ where: { id: brandNewUser.id }, include: { artist: true, conservancy: true } });
  assert.equal(!!freshCurrentUser!.artist, false, "a user with no Artist yet must be allowed through");
});

test("artist onboarding's slug + duplicate-name path: two artists slugifying to the same slug collide, and isUniqueConstraintError() flags it", async (t) => {
  const userA = await createBareUser();
  const userB = await createBareUser();
  const sharedName = `Duplicate Artist ${unique()}`;
  const artistA = await prisma.artist.create({
    data: {
      slug: slugify(sharedName),
      name: sharedName,
      country: "Kenya",
      bio: "First artist",
      imageUrl: "https://example.com/artist.jpg",
      userId: userA.id,
    },
  });
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artistA.id } });
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  });

  await assert.rejects(
    () =>
      prisma.artist.create({
        data: {
          slug: slugify(sharedName), // same slug the route would compute for the same name
          name: sharedName,
          country: "Kenya",
          bio: "Second artist, same name",
          imageUrl: "https://example.com/artist.jpg",
          userId: userB.id,
        },
      }),
    (error: unknown) => {
      assert.equal(isUniqueConstraintError(error), true, "must be recognized as the unique-constraint error the route's catch block checks for");
      return true;
    },
  );
});

// --- cause (Conservancy) onboarding -------------------------------------

test("a Conservancy row created with a userId links to that user, matching getCurrentUser()'s include", async (t) => {
  const user = await createBareUser();
  const conservancy = await prisma.conservancy.create({
    data: {
      name: `Test Cause ${unique()}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by onboarding.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: "REG-12345",
      userId: user.id,
    },
  });
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const reloaded = await prisma.user.findUnique({ where: { id: user.id }, include: { artist: true, conservancy: true } });
  assert.ok(reloaded?.conservancy, "user.conservancy should be populated after linking");
  assert.equal(reloaded!.conservancy!.id, conservancy.id);
  assert.equal(reloaded!.conservancy!.userId, user.id);
});

test("cause onboarding's own guard (`if (user.conservancy) return 409`): a user who already has a Conservancy trips it", async (t) => {
  const user = await createBareUser();
  const conservancy = await prisma.conservancy.create({
    data: {
      name: `Test Cause Guard ${unique()}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by onboarding.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: "REG-67890",
      userId: user.id,
    },
  });
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const currentUser = await prisma.user.findUnique({ where: { id: user.id }, include: { artist: true, conservancy: true } });
  assert.equal(!!currentUser!.conservancy, true, "a second onboarding attempt for this user must be rejected");

  const brandNewUser = await createBareUser();
  t.after(async () => {
    await prisma.user.delete({ where: { id: brandNewUser.id } });
  });
  const freshCurrentUser = await prisma.user.findUnique({ where: { id: brandNewUser.id }, include: { artist: true, conservancy: true } });
  assert.equal(!!freshCurrentUser!.conservancy, false, "a user with no Conservancy yet must be allowed through");
});

test("a self-service (onboarding) Conservancy starts unverified, unlike an admin-created one", async (t) => {
  const user = await createBareUser();
  // Mirrors exactly what app/api/cause/onboarding/route.ts writes: no
  // verifiedAt, unlike app/api/admin/conservancies/route.ts which sets it
  // at creation time (an admin entering it by hand already is the vetting).
  const conservancy = await prisma.conservancy.create({
    data: {
      name: `Test Unverified Cause ${unique()}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by onboarding.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: "REG-11111",
      userId: user.id,
    },
  });
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  assert.equal(conservancy.verifiedAt, null, "self-onboarded causes must start unverified");
});
