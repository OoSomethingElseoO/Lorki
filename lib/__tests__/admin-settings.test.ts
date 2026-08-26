// app/api/admin/settings/route.ts (GET, PATCH) has no getCurrentUser()
// dependency at the route level, same reasoning as admin-users.test.ts.
// This route reads/writes the Settings singleton row (id: "singleton"),
// which already has a real row in this dev database (holding a fake
// Stripe secret key placeholder, per the app's local setup) — every test
// that calls PATCH captures the row's full original state first and
// restores it exactly in t.after(), so nothing here permanently changes
// dev settings.
import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { GET, PATCH } from "@/app/api/admin/settings/route";
import { prisma } from "@/lib/prisma";

const unique = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function snapshotSettings() {
  return prisma.settings.upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" } });
}

async function restoreSettings(original: Awaited<ReturnType<typeof snapshotSettings>>) {
  const { id, updatedAt, ...rest } = original;
  void id;
  void updatedAt;
  await prisma.settings.update({ where: { id: "singleton" }, data: rest });
}

test("GET returns secret fields as booleans, never the actual secret values", async (t) => {
  const original = await snapshotSettings();
  t.after(async () => {
    await restoreSettings(original);
  });

  // Make sure at least one secret is genuinely set, so this test actually
  // exercises the "Set" branch, not just the "unset" branch.
  await prisma.settings.update({ where: { id: "singleton" }, data: { stripeSecretKey: `sk_test_${unique()}` } });

  const response = await GET();
  assert.equal(response.status, 200);
  const body = await response.json();

  assert.equal(typeof body.settings.stripeSecretKeySet, "boolean");
  assert.equal(body.settings.stripeSecretKeySet, true);
  assert.equal(typeof body.settings.flutterwaveSecretKeySet, "boolean");
  assert.equal(typeof body.settings.resendApiKeySet, "boolean");

  const serialized = JSON.stringify(body);
  assert.ok(!serialized.includes("sk_test_"), "the actual secret value must never appear anywhere in the response");
  assert.equal(body.settings.stripeSecretKey, undefined, "the raw field name (not the *Set boolean) must not be present");
});

test("PATCH leaves a secret field unchanged when submitted blank", async (t) => {
  const original = await snapshotSettings();
  t.after(async () => {
    await restoreSettings(original);
  });

  const testKey = `sk_test_${unique()}`;
  await prisma.settings.update({ where: { id: "singleton" }, data: { stripeSecretKey: testKey } });

  const response = await PATCH(patchRequest({ stripeSecretKey: "" }));
  assert.equal(response.status, 200);

  const after = await prisma.settings.findUnique({ where: { id: "singleton" } });
  assert.equal(after!.stripeSecretKey, testKey, "a blank submit must not clear a secret — the admin UI shows it masked");
});

test("PATCH updates a secret field when a real value is submitted", async (t) => {
  const original = await snapshotSettings();
  t.after(async () => {
    await restoreSettings(original);
  });

  const newKey = `sk_test_new_${unique()}`;
  const response = await PATCH(patchRequest({ stripeSecretKey: newKey }));
  assert.equal(response.status, 200);

  const after = await prisma.settings.findUnique({ where: { id: "singleton" } });
  assert.equal(after!.stripeSecretKey, newKey);
});

test("PATCH clears a branding field when submitted blank, unlike a secret field", async (t) => {
  const original = await snapshotSettings();
  t.after(async () => {
    await restoreSettings(original);
  });

  await prisma.settings.update({ where: { id: "singleton" }, data: { siteName: "Some Old Name" } });

  const response = await PATCH(patchRequest({ siteName: "" }));
  assert.equal(response.status, 200);

  const after = await prisma.settings.findUnique({ where: { id: "singleton" } });
  assert.equal(after!.siteName, "", "an explicit blank on a branding field is a real choice, not 'leave alone'");
});
