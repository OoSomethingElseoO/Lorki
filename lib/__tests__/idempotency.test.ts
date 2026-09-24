import "dotenv/config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIdempotency, GUEST_IDEMPOTENCY_SCOPE, storeIdempotencyResponse } from "@/lib/idempotency";
import { prisma } from "@/lib/prisma";

test("a guest idempotency key replays its stored response", async (t) => {
  const key = `idempotency-guest-${Math.random()}`;
  t.after(async () => {
    await prisma.idempotencyStore.deleteMany({ where: { idempotencyKey: key } });
  });

  await storeIdempotencyResponse(key, undefined, 201, { created: true });
  const response = await checkIdempotency(new Request("http://localhost", { headers: { "Idempotency-Key": key } }));

  assert.ok(response);
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { created: true });
  assert.equal(
    await prisma.idempotencyStore.count({ where: { idempotencyKey: key, userId: GUEST_IDEMPOTENCY_SCOPE } }),
    1,
  );
});

test("a missing idempotency key stores nothing", async () => {
  await storeIdempotencyResponse(null, undefined, 201, { created: true });
});
