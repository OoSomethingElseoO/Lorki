import { test } from "node:test";
import assert from "node:assert/strict";
import { parseShareEventInput } from "@/lib/share-events";
import { parseSecurityCaseUpdate } from "@/lib/security-case-validation";

test("share-event validation accepts supported targets and defaults unknown channels", () => {
  assert.deepEqual(parseShareEventInput({ targetType: "artwork", targetId: "art-1" }), {
    targetType: "artwork",
    targetId: "art-1",
    channel: "unknown",
  });
  assert.deepEqual(parseShareEventInput({ targetType: "artist", targetId: "artist-1", channel: "clipboard" }), {
    targetType: "artist",
    targetId: "artist-1",
    channel: "clipboard",
  });
});

test("share-event validation rejects unsupported or oversized targets", () => {
  assert.equal(parseShareEventInput({ targetType: "order", targetId: "o-1" }), null);
  assert.equal(parseShareEventInput({ targetType: "artwork", targetId: "" }), null);
  assert.equal(parseShareEventInput({ targetType: "artwork", targetId: "x".repeat(129) }), null);
  assert.equal(parseShareEventInput(null), null);
});

test("security-case validation accepts triage and normalizes operator input", () => {
  assert.deepEqual(parseSecurityCaseUpdate({ status: "INVESTIGATING", severity: "HIGH", assignedTo: "  admin@example.com ", triageNote: "  investigate login burst  " }), {
    status: "INVESTIGATING",
    severity: "HIGH",
    assignedTo: "admin@example.com",
    triageNote: "investigate login burst",
  });
});

test("security-case validation rejects invalid workflow values and types", () => {
  assert.equal(parseSecurityCaseUpdate({ status: "DELETED" }), null);
  assert.equal(parseSecurityCaseUpdate({ severity: "URGENT" }), null);
  assert.equal(parseSecurityCaseUpdate({ assignedTo: 42 }), null);
  assert.equal(parseSecurityCaseUpdate({ resolutionNote: 42 }), null);
});
