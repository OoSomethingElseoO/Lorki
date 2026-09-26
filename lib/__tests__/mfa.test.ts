import assert from "node:assert/strict";
import test from "node:test";
import { buildOtpAuthUri, generateMfaSecret, generateTotp, verifyTotp } from "@/lib/mfa";

test("MFA secrets generate valid otpauth configuration and verify current code", () => {
  const secret = generateMfaSecret();
  const now = 1_700_000_000_000;
  const code = generateTotp(secret, now);
  assert.match(secret, /^[A-Z2-7]{32}$/);
  assert.equal(verifyTotp(secret, code, now), true);
  assert.equal(verifyTotp(secret, code, now + 91_000), false);
  assert.match(buildOtpAuthUri("person@example.com", secret), /^otpauth:\/\/totp\//);
});

test("MFA accepts one time-step clock drift but not malformed codes", () => {
  const secret = generateMfaSecret();
  const now = 1_700_000_000_000;
  assert.equal(verifyTotp(secret, generateTotp(secret, now), now + 30_000), true);
  assert.equal(verifyTotp(secret, "123", now), false);
});
