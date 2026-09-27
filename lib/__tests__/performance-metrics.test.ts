import test from "node:test";
import assert from "node:assert/strict";
import { normalizePerformanceBatch, safePerformanceRoute } from "../performance-metrics";

test("performance batches accept allow-listed metrics and strip query strings", () => {
  const result = normalizePerformanceBatch([{ metric: "LCP", value: 1200, route: "/originals?sort=price", deviceClass: "mobile" }]);
  assert.equal(result?.[0].route, "/originals");
});

test("performance batches reject malformed or oversized input", () => {
  assert.equal(normalizePerformanceBatch([{ metric: "SECRET", value: 10, route: "/", deviceClass: "mobile" }]), null);
  assert.equal(safePerformanceRoute("https://attacker.example"), null);
  assert.equal(normalizePerformanceBatch([{ metric: "LCP", value: 400_000, route: "/", deviceClass: "mobile" }]), null);
});
