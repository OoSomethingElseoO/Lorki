// app/api/admin/animals/route.ts doesn't depend on getCurrentUser() at the
// route level (admin auth is enforced by proxy.ts middleware, which never
// runs when the handler is invoked directly here) — so calling it directly
// exercises exactly the route's own validation/slugify/unique-constraint
// logic, which is what's valuable and otherwise uncovered.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/admin/animals/route";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/animals", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createConservancy() {
  return prisma.conservancy.create({
    data: {
      name: `Test Conservancy ${unique()}`,
      region: "Maasai Mara",
      mission: "A throwaway conservancy created by admin-animals.test.ts",
      website: "https://example.com",
      contactEmail: "conservancy@example.com",
    },
  });
}

test("creating an animal with all required fields succeeds and is correctly slugified", async (t) => {
  const conservancy = await createConservancy();
  const name = `Test Animal ${unique()}`;
  t.after(async () => {
    await prisma.animal.deleteMany({ where: { conservancyId: conservancy.id } });
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
  });

  const response = await POST(
    createRequest({
      name,
      species: "Elephant",
      region: "Maasai Mara",
      story: "A throwaway story.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: conservancy.id,
    }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.animal.name, name);
  assert.equal(body.animal.slug, slugify(name));

  const inDb = await prisma.animal.findUnique({ where: { id: body.animal.id } });
  assert.ok(inDb, "animal row should exist in the database");
  assert.equal(inDb!.slug, slugify(name));
  assert.equal(inDb!.species, "Elephant");
  assert.equal(inDb!.conservancyId, conservancy.id);
});

test("creating an animal with a missing required field is rejected", async (t) => {
  const conservancy = await createConservancy();
  t.after(async () => {
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
  });

  const response = await POST(
    createRequest({
      name: `Test Animal ${unique()}`,
      species: "Elephant",
      // region missing
      story: "A throwaway story.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: conservancy.id,
    }),
  );

  assert.equal(response.status, 400);
});

test("creating an animal with a duplicate name is rejected via the slug unique constraint", async (t) => {
  const conservancy = await createConservancy();
  const name = `Test Duplicate Animal ${unique()}`;
  t.after(async () => {
    await prisma.animal.deleteMany({ where: { conservancyId: conservancy.id } });
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
  });

  const first = await POST(
    createRequest({
      name,
      species: "Elephant",
      region: "Maasai Mara",
      story: "First.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: conservancy.id,
    }),
  );
  assert.equal(first.status, 201);

  const second = await POST(
    createRequest({
      name,
      species: "Elephant",
      region: "Maasai Mara",
      story: "Second, same name.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: conservancy.id,
    }),
  );
  assert.equal(second.status, 409);
  const secondBody = await second.json();
  assert.match(secondBody.error, /already exists/i);

  const count = await prisma.animal.count({ where: { conservancyId: conservancy.id } });
  assert.equal(count, 1, "duplicate creation must not add a second row");
});

test("creating an animal with a conservancyId that doesn't exist is rejected", async () => {
  const name = `Test Orphan Animal ${unique()}`;
  const response = await POST(
    createRequest({
      name,
      species: "Elephant",
      region: "Maasai Mara",
      story: "A throwaway story.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: "does-not-exist-id",
    }),
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(body.error, /conservancyId/i);

  const count = await prisma.animal.count({ where: { name } });
  assert.equal(count, 0);
});

test("GET returns the list of animals including a newly created one", async (t) => {
  const conservancy = await createConservancy();
  const name = `Test List Animal ${unique()}`;
  t.after(async () => {
    await prisma.animal.deleteMany({ where: { conservancyId: conservancy.id } });
    await prisma.conservancy.delete({ where: { id: conservancy.id } });
  });

  const created = await POST(
    createRequest({
      name,
      species: "Elephant",
      region: "Maasai Mara",
      story: "A throwaway story.",
      imageUrl: "https://example.com/animal.jpg",
      conservancyId: conservancy.id,
    }),
  );
  assert.equal(created.status, 201);

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.animals.some((animal: { name: string }) => animal.name === name));
});
