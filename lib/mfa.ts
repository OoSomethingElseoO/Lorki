import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { decryptSetting, encryptSetting } from "@/lib/secret-settings";
import { hashPassword, verifyPassword } from "@/lib/password";

const STEP_SECONDS = 30;
const DIGITS = 6;
const ISSUER = "Lorki Originals";

function base32Encode(input: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("Invalid MFA secret");
    buffer = (buffer << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateMfaSecret(): string {
  return base32Encode(randomBytes(20));
}

export function buildOtpAuthUri(email: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent(`${ISSUER}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

function codeFor(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotp(secret: string, now = Date.now()): string {
  return codeFor(secret, Math.floor(now / 1000 / STEP_SECONDS));
}

export function verifyTotp(secret: string, input: string, now = Date.now()): boolean {
  const normalized = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  const counter = Math.floor(now / 1000 / STEP_SECONDS);
  for (const drift of [-1, 0, 1]) {
    const expected = Buffer.from(codeFor(secret, counter + drift));
    const received = Buffer.from(normalized);
    if (timingSafeEqual(expected, received)) return true;
  }
  return false;
}

export function encryptMfaSecret(secret: string): string {
  return encryptSetting(secret);
}

export function decryptMfaSecret(secret: string | null | undefined): string | null {
  const value = decryptSetting(secret);
  return value ?? null;
}

export function createChallengeToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashChallengeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRecoveryCodes(count = 8): Promise<{ plain: string[]; hashes: string[] }> {
  const plain = Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase());
  const hashes = await Promise.all(plain.map((code) => hashPassword(code)));
  return { plain, hashes };
}

export async function verifyRecoveryCode(code: string, hashes: string[]): Promise<number> {
  for (let index = 0; index < hashes.length; index += 1) {
    if (await verifyPassword(code.replace(/\s/g, "").toUpperCase(), hashes[index])) return index;
  }
  return -1;
}
