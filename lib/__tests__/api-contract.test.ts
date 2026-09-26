import test from "node:test";
import assert from "node:assert/strict";
import { API_CONTRACT_VERSION, apiContractError, apiJson } from "@/lib/api-contract";

test("apiJson advertises the stable contract version without changing the payload", async () => {
  const response = apiJson({ ok: true });
  assert.equal(response.headers.get("x-api-contract-version"), API_CONTRACT_VERSION);
  assert.deepEqual(await response.json(), { ok: true });
});

test("apiContractError uses a machine-readable error envelope", async () => {
  const response = apiContractError("INVALID_INPUT", "The payload is invalid", 400, { field: "name" });
  assert.equal(response.status, 400);
  assert.equal(response.headers.get("x-api-contract-version"), API_CONTRACT_VERSION);
  assert.deepEqual(await response.json(), {
    error: { code: "INVALID_INPUT", message: "The payload is invalid", details: { field: "name" } },
  });
});
