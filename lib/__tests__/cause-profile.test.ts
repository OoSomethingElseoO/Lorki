// app/api/cause/profile/route.ts (PATCH) gates on getCurrentUser(), which
// throws outside a real Next.js request scope — same situation as the
// seller-*.test.ts files. The genuinely interesting, non-trivial business
// logic here is the re-verification-invalidation rule: a name or
// registration-number change on an already-verified cause resets
// verifiedAt (and the specific checked-at field that check no longer
// covers) to null, per the route's own comment. These tests reproduce
// that exact computation (nameChanged / registrationNumberChanged /
// needsReverification) and the route's exact update `data` object against
// real Conservancy rows.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createVerifiedConservancy() {
  const id = unique();
  return prisma.conservancy.create({
    data: {
      name: `Test Cause ${id}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by cause-profile.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: `REG-${id}`,
      verifiedAt: new Date(),
      sanctionsCheckedAt: new Date(),
      registrationCheckedAt: new Date(),
      registrationVerificationMethod: "Manual registry lookup",
    },
  });
}

// Reproduces app/api/cause/profile/route.ts's PATCH update logic verbatim.
async function applyProfileUpdate(cause: { id: string; name: string; registrationNumber: string | null; verifiedAt: Date | null }, body: { name: string; registrationNumber: string }) {
  const nameChanged = body.name !== cause.name;
  const registrationNumberChanged = body.registrationNumber !== cause.registrationNumber;
  const needsReverification = (nameChanged || registrationNumberChanged) && cause.verifiedAt !== null;

  return prisma.conservancy.update({
    where: { id: cause.id },
    data: {
      name: body.name,
      registrationNumber: body.registrationNumber,
      ...(needsReverification
        ? {
            verifiedAt: null,
            ...(nameChanged ? { sanctionsCheckedAt: null } : {}),
            ...(registrationNumberChanged ? { registrationCheckedAt: null, registrationVerificationMethod: null } : {}),
          }
        : {}),
    },
  });
}

test("changing name on a verified cause resets verifiedAt and sanctionsCheckedAt, but not registrationCheckedAt", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const updated = await applyProfileUpdate(cause, { name: "A Brand New Name", registrationNumber: cause.registrationNumber! });

  assert.equal(updated.verifiedAt, null, "verification must be invalidated");
  assert.equal(updated.sanctionsCheckedAt, null, "name changed, so the sanctions check (screened against the old name) must be invalidated");
  assert.ok(updated.registrationCheckedAt, "registration number didn't change, so that check must stay intact");
  assert.ok(updated.registrationVerificationMethod);
});

test("changing registrationNumber on a verified cause resets verifiedAt and registrationCheckedAt, but not sanctionsCheckedAt", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const updated = await applyProfileUpdate(cause, { name: cause.name, registrationNumber: "REG-CHANGED" });

  assert.equal(updated.verifiedAt, null);
  assert.ok(updated.sanctionsCheckedAt, "name didn't change, so the sanctions check must stay intact");
  assert.equal(updated.registrationCheckedAt, null, "registration number changed, so that check must be invalidated");
  assert.equal(updated.registrationVerificationMethod, null);
});

test("changing neither name nor registrationNumber leaves verification fully intact", async (t) => {
  const cause = await createVerifiedConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });

  const updated = await applyProfileUpdate(cause, { name: cause.name, registrationNumber: cause.registrationNumber! });

  assert.ok(updated.verifiedAt, "verification must stay intact when neither identity field changes");
  assert.ok(updated.sanctionsCheckedAt);
  assert.ok(updated.registrationCheckedAt);
});

test("changing name on an UNVERIFIED cause does not touch verifiedAt (nothing to invalidate)", async (t) => {
  const id = unique();
  const cause = await prisma.conservancy.create({
    data: {
      name: `Test Unverified Cause ${id}`,
      region: "Maasai Mara",
      mission: "A throwaway cause created by cause-profile.test.ts",
      website: "https://example.com",
      contactEmail: "cause@example.com",
      registrationNumber: `REG-${id}`,
    },
  });
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: cause.id } });
  });
  assert.equal(cause.verifiedAt, null);

  const updated = await applyProfileUpdate(cause, { name: "A New Name", registrationNumber: cause.registrationNumber! });

  assert.equal(updated.verifiedAt, null, "still unverified — nothing changed here, but nothing to break either");
});
