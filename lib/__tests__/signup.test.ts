// DB-integration tests of the /api/signup route handler, called directly
// (no running server) per the new App Router testing pattern: construct a
// real Request, call the exported POST function, assert on the HTTP
// response AND on real database state afterward via Prisma. Every test
// uses a unique/timestamped email and a distinct fake IP (this route is
// rate-limited 5/5min per IP, and the limiter's in-memory Map persists for
// the whole `tsx --test` process) so tests never rate-limit each other.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/signup/route";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE } from "@/lib/auth";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const fakeIp = () => `10.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 254) + 1}`;

function signupRequest(body: unknown, ip: string) {
  return new Request("http://localhost/api/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify(body),
  });
}

test("signup creates a user and returns a session cookie", async (t) => {
  const email = `signup-${unique()}@example.com`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const response = await POST(signupRequest({ email, password: "password123" }, fakeIp()));

  assert.equal(response.status, 201);
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "expected a Set-Cookie header");
  assert.ok(setCookie!.includes(SESSION_COOKIE), "expected the session cookie to be set");

  const user = await prisma.user.findUnique({ where: { email } });
  assert.ok(user, "user row should exist in the database");
  assert.equal(user!.email, email);
  assert.notEqual(user!.passwordHash, "password123", "password must be hashed, not stored in plain text");
});

test("signup rejects a duplicate email", async (t) => {
  const email = `signup-dup-${unique()}@example.com`;
  const ip = fakeIp();
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const first = await POST(signupRequest({ email, password: "password123" }, ip));
  assert.equal(first.status, 201);

  const second = await POST(signupRequest({ email, password: "anotherPassword1" }, ip));
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.match(body.error, /already exists/i);

  const count = await prisma.user.count({ where: { email } });
  assert.equal(count, 1, "duplicate signup must not create a second row");
});

test("signup rejects a password under 8 characters", async (t) => {
  const email = `signup-shortpw-${unique()}@example.com`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const response = await POST(signupRequest({ email, password: "short1" }, fakeIp()));
  assert.equal(response.status, 400);

  const user = await prisma.user.findUnique({ where: { email } });
  assert.equal(user, null, "no user should be created for a rejected signup");
});

test("signup rejects missing email or password", async () => {
  const missingPassword = await POST(signupRequest({ email: `signup-${unique()}@example.com` }, fakeIp()));
  assert.equal(missingPassword.status, 400);

  const missingEmail = await POST(signupRequest({ password: "password123" }, fakeIp()));
  assert.equal(missingEmail.status, 400);
});

test("signup is rate-limited after 5 attempts from the same IP", async (t) => {
  const ip = fakeIp();
  const emails: string[] = [];
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
  });

  for (let i = 0; i < 5; i++) {
    const email = `signup-rl-${unique()}@example.com`;
    emails.push(email);
    const response = await POST(signupRequest({ email, password: "password123" }, ip));
    assert.equal(response.status, 201, `attempt ${i + 1} should succeed`);
  }

  const sixthEmail = `signup-rl-${unique()}@example.com`;
  const sixth = await POST(signupRequest({ email: sixthEmail, password: "password123" }, ip));
  assert.equal(sixth.status, 429);

  const user = await prisma.user.findUnique({ where: { email: sixthEmail } });
  assert.equal(user, null, "the rate-limited attempt must not create a user");
});
