import test from "node:test";
import assert from "node:assert/strict";
import { shouldIgnoreDuplicateInboxEvent, shouldReprocessInboxEvent } from "@/lib/webhook-inbox";

test("webhook inbox reprocesses failed events but not completed or in-flight events", () => {
  assert.equal(shouldReprocessInboxEvent("FAILED"), true);
  assert.equal(shouldReprocessInboxEvent("PROCESSED"), false);
  assert.equal(shouldReprocessInboxEvent("RECEIVED"), false);
  assert.equal(shouldIgnoreDuplicateInboxEvent("PROCESSED"), true);
  assert.equal(shouldIgnoreDuplicateInboxEvent("RECEIVED"), true);
  assert.equal(shouldIgnoreDuplicateInboxEvent(undefined), true);
});
