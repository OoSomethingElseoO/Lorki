// isRateLimited is now Postgres-backed (see lib/rate-limit.ts's own
// comment for why — an in-memory Map doesn't work once server.cluster.js
// runs this app as multiple worker processes), so this needs a real DB
// connection same as any other DB-driven test in this suite.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRateLimited } from "@/lib/rate-limit";

test("allows requests up to the limit, then blocks", async () => {
  const key = `test-key-${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    assert.equal(await isRateLimited(key, 3, 60_000), false, `request ${i + 1} should be allowed`);
  }
  assert.equal(await isRateLimited(key, 3, 60_000), true, "4th request should be blocked");
});

test("different keys have independent limits", async () => {
  const keyA = `test-a-${Math.random()}`;
  const keyB = `test-b-${Math.random()}`;
  assert.equal(await isRateLimited(keyA, 1, 60_000), false);
  assert.equal(await isRateLimited(keyA, 1, 60_000), true);
  assert.equal(await isRateLimited(keyB, 1, 60_000), false, "a different key must not be affected by keyA's limit");
});

test("a request outside the window doesn't count against the limit", async () => {
  const key = `test-window-${Math.random()}`;
  assert.equal(await isRateLimited(key, 1, 10), false);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(await isRateLimited(key, 1, 10), false, "old hit should have aged out of the window");
});
