// Same rationale as admin-animals.test.ts: app/api/admin/news/route.ts has
// no getCurrentUser() dependency, so the route's own validation/slugify/
// unique-constraint logic is directly and cleanly testable.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, POST } from "@/app/api/admin/news/route";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function createRequest(body: unknown) {
  return new Request("http://localhost/api/admin/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("creating a news article with all required fields succeeds, defaults to DRAFT, and is correctly slugified", async (t) => {
  const title = `Test Article ${unique()}`;
  t.after(async () => {
    await prisma.newsArticle.deleteMany({ where: { title } });
  });

  const response = await POST(
    createRequest({
      title,
      summary: "A throwaway summary.",
      body: "A throwaway body.",
      imageUrl: "https://example.com/article.jpg",
    }),
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.article.title, title);
  assert.equal(body.article.slug, slugify(title));
  assert.equal(body.article.status, "DRAFT");

  const inDb = await prisma.newsArticle.findUnique({ where: { id: body.article.id } });
  assert.ok(inDb, "article row should exist in the database");
  assert.equal(inDb!.slug, slugify(title));
});

test("creating a news article with a missing required field is rejected", async () => {
  const response = await POST(
    createRequest({
      title: `Test Article ${unique()}`,
      summary: "A throwaway summary.",
      // body missing
      imageUrl: "https://example.com/article.jpg",
    }),
  );

  assert.equal(response.status, 400);
});

test("creating a news article with a duplicate title is rejected via the slug unique constraint", async (t) => {
  const title = `Test Duplicate Article ${unique()}`;
  t.after(async () => {
    await prisma.newsArticle.deleteMany({ where: { title } });
  });

  const first = await POST(
    createRequest({ title, summary: "First.", body: "First body.", imageUrl: "https://example.com/article.jpg" }),
  );
  assert.equal(first.status, 201);

  const second = await POST(
    createRequest({ title, summary: "Second.", body: "Second body.", imageUrl: "https://example.com/article.jpg" }),
  );
  assert.equal(second.status, 409);
  const secondBody = await second.json();
  assert.match(secondBody.error, /already exists/i);

  const count = await prisma.newsArticle.count({ where: { title } });
  assert.equal(count, 1, "duplicate creation must not add a second row");
});

test("GET returns the list of articles including a newly created one", async (t) => {
  const title = `Test List Article ${unique()}`;
  t.after(async () => {
    await prisma.newsArticle.deleteMany({ where: { title } });
  });

  const created = await POST(
    createRequest({ title, summary: "A throwaway summary.", body: "A throwaway body.", imageUrl: "https://example.com/article.jpg" }),
  );
  assert.equal(created.status, 201);

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(body.articles.some((article: { title: string }) => article.title === title));
});
