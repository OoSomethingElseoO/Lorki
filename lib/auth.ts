import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "lorki_session";
const PURPOSE = "session";

export async function createUserSessionToken(userId: string): Promise<string> {
  return createSessionToken(PURPOSE, userId);
}

// Pure signature check, no DB — safe to call from proxy.ts. Only tells you
// "this token was genuinely issued for this user id," not what that user
// can actually do; role checks need the fresh DB read below.
export async function verifyUserSessionToken(token: string | undefined | null): Promise<string | null> {
  return verifySessionToken(PURPOSE, token);
}

// The one place role access is decided, always against a fresh row — never
// baked into the token — so a promotion (made an admin, started selling)
// takes effect on the very next request, not after a re-login.
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const userId = await verifyUserSessionToken(token);
  if (!userId) {
    return null;
  }
  return prisma.user.findUnique({ where: { id: userId }, include: { artist: true } });
}
