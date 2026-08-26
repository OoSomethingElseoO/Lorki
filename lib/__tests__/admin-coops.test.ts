// Same rationale as admin-animals.test.ts: app/api/admin/co-ops/route.ts
// has no getCurrentUser() dependency, so it's directly testable.
//
// Unlike animals/news, CoOp has no slug field and CoOp.name has no @unique
// constraint in prisma/schema.prisma (confirmed by reading the schema) —
// the route also has no try/catch for a unique-constraint error at all. So
// there is no "duplicate name is rejected" rule to test here; instead this
// documents the actual current behavior (two co-ops with the same name are
// both allowed) so a future schema change that adds uniqueness is the
// thing that would need to update this test, not silently go uncovered.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/admin/co-ops/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/co-ops", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creating a co-op with all required fields succeeds", async (t) => {
  const name = `Test Co-Op ${unique()}`;
  t.after(async () => {
    await prisma.coOp.deleteMany({ where: { name } });
  });

  const response = await POST(createRequest({ name, region: "Nakuru", contactEmail: "coop@example.com" }));

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.coOp.name, name);

  const inDb = await prisma.coOp.findUnique({ where: { id: body.coOp.id } });
  assert.ok(inDb, "co-op row should exist in the database");
  assert.equal(inDb!.region, "Nakuru");
  assert.equal(inDb!.contactEmail, "coop@example.com");
});

test("creating a co-op with a missing required field is rejected", async () => {
  const response = await POST(createRequest({ name: `Test Co-Op ${unique()}`, region: "Nakuru" /* contactEmail missing */ }));
  assert.equal(response.status, 400);
});

test("creating a co-op with a duplicate name is currently allowed (no unique constraint on CoOp.name)", async (t) => {
  const name = `Test Duplicate Co-Op ${unique()}`;
  t.after(async () => {
    await prisma.coOp.deleteMany({ where: { name } });
  });

  const first = await POST(createRequest({ name, region: "Nakuru", contactEmail: "coop-a@example.com" }));
  const second = await POST(createRequest({ name, region: "Nakuru", contactEmail: "coop-b@example.com" }));

  assert.equal(first.status, 201);
  assert.equal(second.status, 201);

  const count = await prisma.coOp.count({ where: { name } });
  assert.equal(count, 2, "both rows are created since there is no uniqueness rule on name today");
});

test("GET returns the list of co-ops including a newly created one", async (t) => {
  const name = `Test List Co-Op ${unique()}`;
  t.after(async () => {
    await prisma.coOp.deleteMany({ where: { name } });
  });

  const created = await POST(createRequest({ name, region: "Nakuru", contactEmail: "coop@example.com" }));
  assert.equal(created.status, 201);

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.coOps.some((coOp: { name: string }) => coOp.name === name));
});
