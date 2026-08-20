import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify } from "@/lib/slugify";

test("lowercases and hyphenates spaces", () => {
  assert.equal(slugify("Mara Lion Project"), "mara-lion-project");
});

test("strips punctuation", () => {
  assert.equal(slugify("Kat's Gallery & Co."), "kat-s-gallery-co");
});

test("collapses repeated separators", () => {
  assert.equal(slugify("Too   Many    Spaces"), "too-many-spaces");
});

test("trims leading and trailing hyphens", () => {
  assert.equal(slugify("  --Leading and trailing--  "), "leading-and-trailing");
});

test("leaves an already-clean slug unchanged", () => {
  assert.equal(slugify("lorkulup"), "lorkulup");
});
