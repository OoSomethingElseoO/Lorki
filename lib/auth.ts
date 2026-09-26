import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "lorki_session";
const PURPOSE = "session";

export async function createUserSessionToken(userId: string, sessionVersion?: number, mfaVerified = false): Promise<string> {
  const version = sessionVersion ?? (await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } }))?.sessionVersion ?? 0;
  return createSessionToken(PURPOSE, `${userId}|${version}|${mfaVerified ? "mfa" : "password"}`);
}

// Pure signature check, no DB — safe to call from proxy.ts. Only tells you
// "this token was genuinely issued for this user id," not what that user
// can actually do; role checks need the fresh DB read below.
export async function verifyUserSessionToken(token: string | undefined | null): Promise<string | null> {
  const details = await verifyUserSessionTokenDetails(token);
  return details?.userId ?? null;
}

export async function verifyUserSessionTokenDetails(token: string | undefined | null): Promise<{ userId: string; sessionVersion: number | null; mfaVerified: boolean } | null> {
  const subject = await verifySessionToken(PURPOSE, token);
  if (!subject) return null;
  const [userId, version, factor] = subject.split("|", 3);
  const parsed = version === undefined ? null : Number(version);
  return { userId, sessionVersion: Number.isInteger(parsed) ? parsed : null, mfaVerified: factor === "mfa" };
}

export async function hasMfaVerifiedSession(request: Request): Promise<boolean> {
  const token = request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))?.[1];
  return Boolean((await verifyUserSessionTokenDetails(token))?.mfaVerified);
}

// The one place role access is decided, always against a fresh row — never
// baked into the token — so a promotion (made an admin, started selling)
// takes effect on the very next request, not after a re-login. Route handlers
// may pass their Request explicitly; direct Node tests have no Next request
// scope, while production callers can continue using cookies().
export async function getCurrentUser(request?: Request) {
  const token = request
    ? request.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`))?.[1]
    : (await cookies()).get(SESSION_COOKIE)?.value;
  const details = await verifyUserSessionTokenDetails(token);
  if (!details) {
    return null;
  }
  // Suspended, deletion-requested, and anonymized accounts retain their
  // records but cannot authenticate or call protected user routes. The
  // sessionVersion check below lets lifecycle actions revoke every old token
  // without needing a stateful session table.
  return prisma.user.findFirst({
    where: { id: details.userId, accountStatus: "ACTIVE", ...(details.sessionVersion === null ? {} : { sessionVersion: details.sessionVersion }) },
    include: { artist: true, conservancy: true },
  });
}
