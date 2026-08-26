// Same rationale as admin-animals.test.ts: app/api/admin/conservancies/route.ts
// has no getCurrentUser() dependency, so it's directly testable.
//
// Conservancy.name has no @unique constraint in prisma/schema.prisma
// (confirmed by reading the schema), and this route has no try/catch for a
// unique-constraint error either — so there's no "duplicate name rejected"
// rule here, same situation as CoOp (see admin-coops.test.ts). What IS a
// genuinely interesting, otherwise-uncovered rule for this specific route:
// unlike a self-service /api/cause/onboarding conservancy (which starts
// unverified — see onboarding.test.ts), an admin-created one is verified
// at creation, per the route's own comment ("an admin entering this by
// hand already is the vetting").
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/admin/conservancies/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/conservancies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creating a conservancy with all required fields succeeds and is verified at creation", async (t) => {
  const name = `Test Conservancy ${unique()}`;
  t.after(async () => {
    await prisma.conservancy.deleteMany({ where: { name } });
  });

  const before = new Date();
  const response = await POST(
    createRequest({ name, region: "Maasai Mara", mission: "A throwaway mission.", website: "https://example.com", contactEmail: "conservancy@example.com" }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.conservancy.name, name);
  assert.ok(body.conservancy.verifiedAt, "an admin-created conservancy must be verified at creation");
  assert.ok(new Date(body.conservancy.verifiedAt).getTime() >= before.getTime());

  const inDb = await prisma.conservancy.findUnique({ where: { id: body.conservancy.id } });
  assert.ok(inDb, "conservancy row should exist in the database");
  assert.ok(inDb!.verifiedAt);
});

test("creating a conservancy with a missing required field is rejected", async () => {
  const response = await POST(
    createRequest({ name: `Test Conservancy ${unique()}`, region: "Maasai Mara", mission: "A throwaway mission." /* website, contactEmail missing */ }),
  );
  assert.equal(response.status, 400);
});

test("creating a conservancy with a duplicate name is currently allowed (no unique constraint on Conservancy.name)", async (t) => {
  const name = `Test Duplicate Conservancy ${unique()}`;
  t.after(async () => {
    await prisma.conservancy.deleteMany({ where: { name } });
  });

  const first = await POST(
    createRequest({ name, region: "Maasai Mara", mission: "First.", website: "https://example.com", contactEmail: "a@example.com" }),
  );
  const second = await POST(
    createRequest({ name, region: "Maasai Mara", mission: "Second.", website: "https://example.com", contactEmail: "b@example.com" }),
  );

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const count = await prisma.conservancy.count({ where: { name } });
  assert.equal(count, 2, "both rows are created since there is no uniqueness rule on name today");
});

test("GET returns the list of conservancies including a newly created one", async (t) => {
  const name = `Test List Conservancy ${unique()}`;
  t.after(async () => {
    await prisma.conservancy.deleteMany({ where: { name } });
  });

  const created = await POST(
    createRequest({ name, region: "Maasai Mara", mission: "A throwaway mission.", website: "https://example.com", contactEmail: "conservancy@example.com" }),
  );
  assert.equal(created.status, 201);

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.conservancies.some((conservancy: { name: string }) => conservancy.name === name));
});
