import assert from "node:assert/strict";
import test from "node:test";
import { MutationOwner } from "../owned-mutation-core";

test("a newer mutation owns the result and aborts the older request", () => {
  const owner = new MutationOwner();
  const first = owner.begin();
  const second = owner.begin();

  assert.equal(first.signal.aborted, true);
  assert.equal(owner.isCurrent(first.generation), false);
  assert.equal(owner.isCurrent(second.generation), true);
});

test("cancelling invalidates an in-flight mutation", () => {
  const owner = new MutationOwner();
  const request = owner.begin();
  owner.cancel();

  assert.equal(request.signal.aborted, true);
  assert.equal(owner.isCurrent(request.generation), false);
});
