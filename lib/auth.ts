import { createSessionToken, verifySessionToken } from "@/lib/session-token";

export const ADMIN_SESSION_COOKIE = "lorki_admin_session";
const PURPOSE = "admin";

export async function createAdminSessionToken(adminUserId: string): Promise<string> {
  return createSessionToken(PURPOSE, adminUserId);
}

// Returns the AdminUser id the token was issued for, or null if invalid.
// Purely cryptographic — no DB lookup — so this stays safe to call from
// middleware. Callers that need to confirm the user still exists (e.g. after
// they've been deleted) should look it up themselves.
export async function verifyAdminSessionToken(token: string | undefined | null): Promise<string | null> {
  return verifySessionToken(PURPOSE, token);
}

export async function isValidAdminSessionToken(token: string | undefined | null): Promise<boolean> {
  return (await verifyAdminSessionToken(token)) !== null;
}
