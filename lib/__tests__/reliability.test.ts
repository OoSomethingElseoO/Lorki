import test from "node:test";
import assert from "node:assert/strict";
import { CircuitBreaker, isRetryableDatabaseError, isRetryableExternalError, withDatabaseRetry, withExternalRetry } from "@/lib/reliability";
import { featureFlags, isFeatureEnabled } from "@/lib/feature-flags";

test("circuit breaker opens after bounded failures and half-opens after cooldown", async () => {
  const breaker = new CircuitBreaker(2, 10);
  await assert.rejects(() => breaker.run(async () => { throw new Error("down"); }));
  await assert.rejects(() => breaker.run(async () => { throw new Error("down"); }));
  assert.equal(breaker.getState(), "OPEN");
  assert.rejects(() => breaker.run(async () => "not-called"));
  assert.equal(breaker.getState(Date.now() + 11), "HALF_OPEN");
  assert.equal(await breaker.run(async () => "ok", Date.now() + 11), "ok");
  assert.equal(breaker.getState(), "CLOSED");
});

test("circuit breaker permits only one half-open probe", async () => {
  const breaker = new CircuitBreaker(1, 10);
  await assert.rejects(() => breaker.run(async () => { throw new Error("down"); }));
  let resolveProbe!: (value: string) => void;
  const probePromise = new Promise<string>((resolve) => { resolveProbe = resolve; });
  const probe = breaker.run(() => probePromise, Date.now() + 11);
  await assert.rejects(() => breaker.run(async () => "second", Date.now() + 11), /DEPENDENCY_CIRCUIT_OPEN/);
  resolveProbe("ok");
  assert.equal(await probe, "ok");
});

test("circuit breaker does not open for non-transient failures when configured", async () => {
  const breaker = new CircuitBreaker(2, 10, (error) => (error as { status?: number }).status !== 400);
  await assert.rejects(() => breaker.run(async () => { throw Object.assign(new Error("bad request"), { status: 400 }); }));
  await assert.rejects(() => breaker.run(async () => { throw Object.assign(new Error("bad request"), { status: 400 }); }));
  assert.equal(breaker.getState(), "CLOSED");
});

test("database retry retries transient errors and stops on permanent errors", async () => {
  let attempts = 0;
  const value = await withDatabaseRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("serialization failure"), { code: "40001" });
    return "ok";
  });
  assert.equal(value, "ok");
  assert.equal(attempts, 3);
  assert.equal(isRetryableDatabaseError({ code: "P2034" }), true);
  assert.equal(isRetryableDatabaseError({ code: "P2002" }), false);
});

test("external retry is bounded and retries only transient failures", async () => {
  let attempts = 0;
  const value = await withExternalRetry(async () => {
    attempts += 1;
    if (attempts < 2) throw Object.assign(new Error("upstream timeout"), { status: 503 });
    return "ok";
  }, { baseDelayMs: 1 });
  assert.equal(value, "ok");
  assert.equal(attempts, 2);
  assert.equal(isRetryableExternalError({ status: 503 }), true);
  assert.equal(isRetryableExternalError({ status: 400 }), false);
  await assert.rejects(() => withExternalRetry(async () => {
    throw Object.assign(new Error("invalid request"), { status: 400 });
  }, { attempts: 3, baseDelayMs: 1 }));
});

test("feature flags preserve existing defaults and honor explicit overrides", () => {
  const env = { FEATURE_AUCTIONS: "true", FEATURE_SHARE_ANALYTICS: "garbage" };
  assert.equal(isFeatureEnabled("AUCTIONS", env), true);
  assert.equal(isFeatureEnabled("SHARE_ANALYTICS", env), true);
  assert.equal(featureFlags({ FEATURE_AUTOMATIC_PAYOUTS: "false" }).AUTOMATIC_PAYOUTS, false);
});
