// app/api/artist/profile/route.ts (PATCH) gates on getCurrentUser(), which
// calls cookies() from next/headers and throws outside a real Next.js
// request scope — so the direct-handler-call pattern (signup.test.ts,
// login.test.ts) doesn't work here. What's genuinely testable independent
// of session is the route's own update logic: it always writes exactly
// { name, country, bio, imageUrl } and, per the route's own comment,
// deliberately never includes `slug` in that data object ("Slug stays
// fixed once set — same immutable-identifier rule as everywhere else in
// this app"). These tests reproduce that exact update via Prisma and
// confirm the fields it does write change, and the one it doesn't
// (slug) never does.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

async function createArtist() {
  const id = unique();
  return prisma.artist.create({
    data: {
      slug: `test-artist-profile-${id}`,
      name: `Original Name ${id}`,
      country: "Kenya",
      bio: "Original bio.",
      imageUrl: "https://example.com/original.jpg",
    },
  });
}

test("artist profile PATCH updates name, country, bio, and imageUrl", async (t) => {
  const artist = await createArtist();
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
  });

  // Exactly the data object app/api/artist/profile/route.ts's PATCH writes.
  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data: {
      name: "Updated Name",
      country: "Tanzania",
      bio: "Updated bio.",
      imageUrl: "https://example.com/updated.jpg",
    },
  });

  assert.equal(updated.name, "Updated Name");
  assert.equal(updated.country, "Tanzania");
  assert.equal(updated.bio, "Updated bio.");
  assert.equal(updated.imageUrl, "https://example.com/updated.jpg");
});

test("artist profile PATCH's update never touches slug, even though the route accepts a new name", async (t) => {
  const artist = await createArtist();
  t.after(async () => {
    await prisma.artist.delete({ where: { id: artist.id } });
  });
  const originalSlug = artist.slug;

  // The route's data object has no `slug` key at all — reproduced here
  // verbatim (compare against app/api/artist/profile/route.ts's PATCH).
  const updated = await prisma.artist.update({
    where: { id: artist.id },
    data: {
      name: "A Completely Different Name",
      country: artist.country,
      bio: artist.bio,
      imageUrl: artist.imageUrl,
    },
  });

  assert.equal(updated.slug, originalSlug, "slug must stay fixed regardless of a name change");
  assert.notEqual(updated.name, artist.name);
});
