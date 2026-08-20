import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSplit } from "@/lib/payouts";

const defaultCampaign = { artistPercent: 50, conservancyPercent: 25, operationsPercent: 25 };

test("splits an even amount exactly", () => {
  const split = computeSplit(250000, defaultCampaign);
  assert.equal(split.artistCents, 125000);
  assert.equal(split.conservancyCents, 62500);
  assert.equal(split.operationsCents, 62500);
});

test("always sums back to the original amount, including odd cents", () => {
  for (const amountCents of [1, 3, 7, 95_00, 99_99, 1_234_567]) {
    const split = computeSplit(amountCents, defaultCampaign);
    assert.equal(split.artistCents + split.conservancyCents + split.operationsCents, amountCents);
  }
});

test("rounding remainder always lands on operations, never on the artist or conservancy", () => {
  // 9500 * 0.5 = 4750 exact, * 0.25 = 2375 exact — pick a case that doesn't
  // divide evenly to actually exercise the floor/remainder path.
  const split = computeSplit(101, defaultCampaign);
  assert.equal(split.artistCents, 50); // floor(101 * 0.5)
  assert.equal(split.conservancyCents, 25); // floor(101 * 0.25)
  assert.equal(split.operationsCents, 26); // remainder absorbs the rounding
  assert.equal(split.artistCents + split.conservancyCents + split.operationsCents, 101);
});

test("respects a non-default split ratio", () => {
  const split = computeSplit(10000, { artistPercent: 70, conservancyPercent: 20, operationsPercent: 10 });
  assert.equal(split.artistCents, 7000);
  assert.equal(split.conservancyCents, 2000);
  assert.equal(split.operationsCents, 1000);
});

test("zero amount produces zero everywhere", () => {
  const split = computeSplit(0, defaultCampaign);
  assert.deepEqual(split, { artistCents: 0, conservancyCents: 0, operationsCents: 0 });
});
