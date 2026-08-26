// app/api/reset-password/route.ts (POST) has no getCurrentUser()
// dependency — a password-reset flow is inherently for a logged-out
// visitor, so it's directly callable. Covers the token-validation
// conditions read from the route: a token row must exist, be unused
// (usedAt === null), and unexpired (expiresAt >= now); a valid token
// changes the password and marks itself used in the same transaction.
import "dotenv/config";
import { createHash, randomBytes } from "node:crypto";
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/reset-password/route";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

function resetRequest(body: unknown) {
  return new Request("http://localhost/api/reset-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createUserWithToken(overrides: { expiresAt: Date; usedAt?: Date | null }) {
  const email = `reset-${unique()}@example.com`;
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword("originalPassword1") } });
  const rawToken = randomBytes(32).toString("hex");
  const token = await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(rawToken),
      expiresAt: overrides.expiresAt,
      usedAt: overrides.usedAt ?? null,
    },
  });
  return { user, token, rawToken };
}

test("a valid, unexpired, unused token changes the password and marks itself used", async (t) => {
  const { user, token, rawToken } = await createUserWithToken({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  t.after(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(resetRequest({ token: rawToken, password: "brandNewPassword1" }));
  assert.equal(response.status, 200);

  const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(await verifyPassword("brandNewPassword1", updatedUser.passwordHash), "password must actually change");
  assert.ok(!(await verifyPassword("originalPassword1", updatedUser.passwordHash)), "old password must no longer work");

  const updatedToken = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } });
  assert.ok(updatedToken.usedAt, "token must be marked used");
});

test("an expired token is rejected and the password is unchanged", async (t) => {
  const { user, rawToken } = await createUserWithToken({ expiresAt: new Date(Date.now() - 60 * 1000) });
  t.after(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(resetRequest({ token: rawToken, password: "brandNewPassword1" }));
  assert.equal(response.status, 400);

  const stillUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(await verifyPassword("originalPassword1", stillUser.passwordHash), "an expired token must not change the password");
});

test("an already-used token is rejected, even if not yet expired", async (t) => {
  const { user, rawToken } = await createUserWithToken({ expiresAt: new Date(Date.now() + 60 * 60 * 1000), usedAt: new Date() });
  t.after(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(resetRequest({ token: rawToken, password: "brandNewPassword1" }));
  assert.equal(response.status, 400);

  const stillUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  assert.ok(await verifyPassword("originalPassword1", stillUser.passwordHash), "a reused token must not change the password");
});

test("an unknown token is rejected", async () => {
  const response = await POST(resetRequest({ token: "not-a-real-token", password: "brandNewPassword1" }));
  assert.equal(response.status, 400);
});

test("a password under 8 characters is rejected even with a valid token", async (t) => {
  const { user, token, rawToken } = await createUserWithToken({ expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  t.after(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(resetRequest({ token: rawToken, password: "short1" }));
  assert.equal(response.status, 400);

  const stillUnused = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: token.id } });
  assert.equal(stillUnused.usedAt, null, "a rejected reset must not consume the token");
});
