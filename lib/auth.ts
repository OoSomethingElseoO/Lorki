export const ADMIN_SESSION_COOKIE = "lorki_admin_session";

const SESSION_VALUE = "admin";
const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getKey(secret: string) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

// Single-admin MVP: no user table, just a signed cookie proving "you know
// ADMIN_PASSWORD." Web Crypto (not Node's crypto) so this runs in both the
// Node runtime and Next.js middleware's Edge runtime.
export async function createAdminSessionToken(): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(SESSION_VALUE));
  return `${SESSION_VALUE}.${toBase64Url(signature)}`;
}

export async function isValidAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) {
    return false;
  }
  const expected = await createAdminSessionToken();
  return token === expected;
}
