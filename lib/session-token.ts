// Shared signed-cookie mechanism for both admin and customer sessions. A
// token is `${subjectId}.${signature}` — the signature covers the purpose
// (so an admin token can never be replayed as a customer token or vice
// versa) plus the subject id. No DB lookup needed to verify, so this stays
// safe to call from Next.js middleware (Edge runtime) as well as normal
// server code — Web Crypto, not Node's crypto module.
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

async function sign(purpose: string, subjectId: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  const key = await getKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${purpose}:${subjectId}`));
  return toBase64Url(signature);
}

export async function createSessionToken(purpose: string, subjectId: string): Promise<string> {
  return `${subjectId}.${await sign(purpose, subjectId)}`;
}

export async function verifySessionToken(purpose: string, token: string | undefined | null): Promise<string | null> {
  if (!token) {
    return null;
  }
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex === -1) {
    return null;
  }
  const subjectId = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expected = await sign(purpose, subjectId);
  return signature === expected ? subjectId : null;
}
