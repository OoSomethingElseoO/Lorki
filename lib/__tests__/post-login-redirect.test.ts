import { test } from "node:test";
import assert from "node:assert/strict";
import { resolvePostLoginRedirect } from "@/lib/post-login-redirect";

const noRoles = { next: null, isAdmin: false, hasArtist: false, hasConservancy: false };

test("a next param always wins, regardless of role", () => {
  assert.equal(
    resolvePostLoginRedirect({ ...noRoles, next: "/originals/some-piece", isAdmin: true }),
    "/originals/some-piece",
  );
});

test("an admin with no next param goes to /admin", () => {
  assert.equal(resolvePostLoginRedirect({ ...noRoles, isAdmin: true }), "/admin");
});

test("an artist-only user goes straight to /seller", () => {
  assert.equal(resolvePostLoginRedirect({ ...noRoles, hasArtist: true }), "/seller");
});

test("a cause-only user goes straight to /cause/profile", () => {
  assert.equal(resolvePostLoginRedirect({ ...noRoles, hasConservancy: true }), "/cause/profile");
});

test("a user with neither role falls back to /account", () => {
  assert.equal(resolvePostLoginRedirect(noRoles), "/account");
});

test("a dual-role user (artist AND conservancy) falls back to /account — no single unambiguous dashboard", () => {
  assert.equal(resolvePostLoginRedirect({ ...noRoles, hasArtist: true, hasConservancy: true }), "/account");
});

test("admin takes priority over artist/conservancy if somehow all three are true", () => {
  assert.equal(
    resolvePostLoginRedirect({ ...noRoles, isAdmin: true, hasArtist: true, hasConservancy: true }),
    "/admin",
  );
});
