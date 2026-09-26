import test from "node:test";
import assert from "node:assert/strict";
import { artistRequired, conservancyRequired } from "@/lib/authorization";

test("authorization helpers fail closed when the session has no owned profile", () => {
  assert.equal(artistRequired(null), null);
  assert.equal(artistRequired({ artist: null }), null);
  assert.equal(conservancyRequired(null), null);
  assert.equal(conservancyRequired({ conservancy: null }), null);
});

test("authorization helpers return only the authenticated user's profile", () => {
  const artist = { id: "artist-a" };
  const conservancy = { id: "cause-a" };
  assert.deepEqual(artistRequired({ artist }), artist);
  assert.deepEqual(conservancyRequired({ conservancy }), conservancy);
});
