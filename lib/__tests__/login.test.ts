// DB-integration tests of the /api/login route handler, called directly
// per the same pattern as signup.test.ts. Each test that needs a real
// account creates its own throwaway user via prisma + hashPassword (not via
// the signup route, to keep this file independent) and tears it down with
// t.after(). Every test uses a distinct fake IP since this route is also
// rate-limited 5/5min per IP against a limiter whose state persists for the
// whole test process.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/login/route";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { SESSION_COOKIE } from "@/lib/auth";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fakeIp = () => `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

function loginRequest(body: unknown, ip: string) {
  return new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

async function createUser(email: string, password: string) {
  return prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });
}

test("login succeeds with correct credentials and returns a session cookie", async (t) => {
  const email = `login-${unique()}@example.com`;
  const password = "correctPassword1";
  const user = await createUser(email, password);
  t.after(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(loginRequest({ email, password }, fakeIp()));

  assert.equal(response.status, 200);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "expected a Set-Cookie header");
  assert.ok(setCookie!.includes(SESSION_COOKIE), "expected the session cookie to be set");
});

test("login rejects a wrong password", async (t) => {
  const email = `login-wrongpw-${unique()}@example.com`;
  const user = await createUser(email, "correctPassword1");
  t.after(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  const response = await POST(loginRequest({ email, password: "wrongPassword1" }, fakeIp()));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("set-cookie"), null);
});

test("login rejects an unknown email", async () => {
  const response = await POST(
    loginRequest({ email: `login-unknown-${unique()}@example.com`, password: "whatever1" }, fakeIp()),
  );
  assert.equal(response.status, 401);
});

test("login rejects missing email or password", async () => {
  const missingPassword = await POST(loginRequest({ email: `login-${unique()}@example.com` }, fakeIp()));
  assert.equal(missingPassword.status, 400);

  const missingEmail = await POST(loginRequest({ password: "whatever1" }, fakeIp()));
  assert.equal(missingEmail.status, 400);
});

test("login is rate-limited after 5 attempts from the same IP", async (t) => {
  const ip = fakeIp();
  const email = `login-rl-${unique()}@example.com`;
  const user = await createUser(email, "correctPassword1");
  t.after(async () => {
    await prisma.user.delete({ where: { id: user.id } });
  });

  for (let i = 0; i < 5; i++) {
    const response = await POST(loginRequest({ email, password: "wrongPassword1" }, ip));
    assert.equal(response.status, 401, `attempt ${i + 1} should be a normal auth failure`);
  }

  const sixth = await POST(loginRequest({ email, password: "correctPassword1" }, ip));
  assert.equal(sixth.status, 429, "6th attempt (even with the right password) should be rate-limited");
});
