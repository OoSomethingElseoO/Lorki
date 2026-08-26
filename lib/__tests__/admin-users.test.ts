// app/api/admin/users/route.ts (GET, POST) has no getCurrentUser()
// dependency at the route level — admin auth is proxy.ts middleware's job,
// which never runs when the handler is called directly here, same
// reasoning as admin-animals.test.ts / admin-conservancies.test.ts.
// Calling it directly exercises exactly the route's own validation,
// hashing, and uniqueness handling.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/admin/users/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creating an admin user succeeds, hashes the password, and returns isAdmin: true", async (t) => {
  const email = `admin-user-${unique()}@example.com`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const response = await POST(createRequest({ name: "Test Admin", email, password: "password123" }));
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.user.email, email);
  // The route's select clause deliberately never returns passwordHash —
  // confirm the response never includes it.
  assert.equal(body.user.passwordHash, undefined);

  const inDb = await prisma.user.findUnique({ where: { email } });
  assert.ok(inDb);
  assert.equal(inDb!.isAdmin, true);
  assert.notEqual(inDb!.passwordHash, "password123", "password must be hashed, not stored in plain text");
});

test("creating an admin user with missing fields is rejected", async () => {
  const response = await POST(createRequest({ name: "Test Admin", email: `admin-user-${unique()}@example.com` }));
  assert.equal(response.status, 400);
});

test("creating an admin user with a password under 8 characters is rejected", async (t) => {
  const email = `admin-user-shortpw-${unique()}@example.com`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const response = await POST(createRequest({ name: "Test Admin", email, password: "short1" }));
  assert.equal(response.status, 400);

  const inDb = await prisma.user.findUnique({ where: { email } });
  assert.equal(inDb, null);
});

test("creating an admin user with a duplicate email is rejected with 409", async (t) => {
  const email = `admin-user-dup-${unique()}@example.com`;
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email } });
  });

  const first = await POST(createRequest({ name: "First Admin", email, password: "password123" }));
  assert.equal(first.status, 201);

  const second = await POST(createRequest({ name: "Second Admin", email, password: "password456" }));
  assert.equal(second.status, 409);

  const count = await prisma.user.count({ where: { email } });
  assert.equal(count, 1, "duplicate creation must not add a second row");
});

test("GET lists only isAdmin: true users, never a non-admin one", async (t) => {
  const adminEmail = `admin-user-list-${unique()}@example.com`;
  const nonAdminEmail = `non-admin-list-${unique()}@example.com`;
  const created = await POST(createRequest({ name: "List Admin", email: adminEmail, password: "password123" }));
  assert.equal(created.status, 201);
  const nonAdmin = await prisma.user.create({ data: { email: nonAdminEmail, passwordHash: "not-a-real-hash", isAdmin: false } });
  t.after(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, nonAdminEmail] } } });
  });

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.users.some((user: { email: string }) => user.email === adminEmail), "admin user must be listed");
  assert.ok(!body.users.some((user: { id: string }) => user.id === nonAdmin.id), "non-admin user must not be listed");
});
