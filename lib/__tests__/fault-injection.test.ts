import assert from "node:assert/strict";
import test from "node:test";
import { CircuitBreaker, withDatabaseRetry, withExternalRetry } from "@/lib/reliability";
import { MutationOwner } from "@/lib/owned-mutation-core";

test("provider timeout is retried and eventually succeeds", async () => {
  let attempts = 0;
  const result = await withExternalRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("upstream timeout"), { status: 503 });
    return "accepted";
  }, { attempts: 3, baseDelayMs: 1 });

  assert.equal(result, "accepted");
  assert.equal(attempts, 3);
});

test("permanent provider rejection is not retried", async () => {
  let attempts = 0;
  await assert.rejects(() => withExternalRetry(async () => {
    attempts += 1;
    throw Object.assign(new Error("invalid beneficiary"), { status: 400 });
  }, { attempts: 3, baseDelayMs: 1 }));
  assert.equal(attempts, 1);
});

test("repeated transient provider failures open the circuit", async () => {
  const breaker = new CircuitBreaker(2, 30_000, (error) => (error as { status?: number }).status === 503);
  const failure = () => breaker.run(async () => {
    throw Object.assign(new Error("provider unavailable"), { status: 503 });
  });

  await assert.rejects(failure);
  await assert.rejects(failure);
  assert.equal(breaker.getState(), "OPEN");
  await assert.rejects(() => breaker.run(async () => "must not call"), /DEPENDENCY_CIRCUIT_OPEN/);
});

test("database deadlock retry is bounded and surfaces exhaustion", async () => {
  let attempts = 0;
  await assert.rejects(() => withDatabaseRetry(async () => {
    attempts += 1;
    throw Object.assign(new Error("deadlock detected"), { code: "40P01" });
  }, 3), /deadlock detected/);
  assert.equal(attempts, 3);
});

test("stale async work cannot regain ownership after cancellation", () => {
  const owner = new MutationOwner();
  const request = owner.begin();
  owner.cancel();
  assert.equal(request.signal.aborted, true);
  assert.equal(owner.isCurrent(request.generation), false);
});
