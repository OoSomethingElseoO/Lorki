// app/api/forgot-password/route.ts (POST) has no auth dependency and is
// safely callable directly (no getCurrentUser()) — rate-limited 5/15min
// per IP like signup/login, so every test uses a distinct fake IP.
// sendPasswordResetEmail() is best-effort and never throws even with no
// Resend key configured (see lib/email.ts), so it's safe to call for real
// in these tests without any mocking.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/forgot-password/route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fakeIp = () => `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

function forgotPasswordRequest(body: unknown, ip: string) {
  return new Request("http://localhost/api/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

test("a registered email returns success and creates a PasswordResetToken row", async (t) => {
  const email = `forgot-${unique()}@example.com`;
  const user = await prisma.user.create({ data: { email, passwordHash: await hashPassword("originalPassword1") } });
  t.after(async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  const before = new Date();
  const response = await POST(forgotPasswordRequest({ email }, fakeIp()));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);

  const tokens = await prisma.passwordResetToken.findMany({ where: { userId: user.id } });
  assert.equal(tokens.length, 1, "a reset token row must be created for a registered email");
  assert.ok(tokens[0].expiresAt.getTime() > before.getTime());
  assert.equal(tokens[0].usedAt, null);
});

test("an unregistered email still returns success, but creates no token row — this is intentional, not a bug", async () => {
  const email = `forgot-unregistered-${unique()}@example.com`;

  const response = await POST(forgotPasswordRequest({ email }, fakeIp()));

  // Route's own comment: "Always report success — confirming whether an
  // email is registered is a real information leak for an account-recovery
  // endpoint." The response must be indistinguishable from the registered
  // case even though nothing was created.
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.ok, true);

  const tokenCount = await prisma.passwordResetToken.count({
    where: { user: { email } },
  });
  assert.equal(tokenCount, 0, "no token should ever be created for an email that isn't registered");
});

test("missing email is rejected with 400", async () => {
  const response = await POST(forgotPasswordRequest({}, fakeIp()));
  assert.equal(response.status, 400);
});

test("forgot-password is rate-limited after 5 attempts from the same IP", async () => {
  const ip = fakeIp();

  for (let i = 0; i < 5; i++) {
    const response = await POST(forgotPasswordRequest({ email: `forgot-rl-${unique()}@example.com` }, ip));
    assert.equal(response.status, 200, `attempt ${i + 1} should succeed`);
  }

  const sixth = await POST(forgotPasswordRequest({ email: `forgot-rl-${unique()}@example.com` }, ip));
  assert.equal(sixth.status, 429);
});
