import test from "node:test";
import assert from "node:assert/strict";
import { normalizeOutboxLimit, OUTBOX_MAX_BATCH } from "@/lib/outbox";

test("outbox batch limits are bounded and malformed scheduler input is safe", () => {
  assert.equal(normalizeOutboxLimit(undefined), 10);
  assert.equal(normalizeOutboxLimit(""), 10);
  assert.equal(normalizeOutboxLimit("0"), 10);
  assert.equal(normalizeOutboxLimit("not-a-number"), 10);
  assert.equal(normalizeOutboxLimit("12"), 12);
  assert.equal(normalizeOutboxLimit(String(OUTBOX_MAX_BATCH + 100)), OUTBOX_MAX_BATCH);
});
