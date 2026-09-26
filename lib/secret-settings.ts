import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "enc:v1:";

function keyBytes(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) throw new Error("SETTINGS_ENCRYPTION_KEY is required to save provider secrets");
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("SETTINGS_ENCRYPTION_KEY must be a 32-byte base64 or hex value");
  return key;
}

export function encryptSetting(value: string): string {
  if (!value || value.startsWith(PREFIX)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSetting(value: string | null | undefined): string | null | undefined {
  if (value == null || !value.startsWith(PREFIX)) return value;
  const [ivText, tagText, dataText] = value.slice(PREFIX.length).split(".");
  if (!ivText || !tagText || !dataText) throw new Error("Malformed encrypted setting");
  const decipher = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(dataText, "base64url")), decipher.final()]).toString("utf8");
}

export function encryptSettingsSecrets<T extends Record<string, unknown>>(data: T, fields: readonly string[]): T {
  const result = { ...data } as Record<string, unknown>;
  for (const field of fields) if (typeof result[field] === "string" && result[field]) result[field] = encryptSetting(result[field] as string);
  return result as T;
}
