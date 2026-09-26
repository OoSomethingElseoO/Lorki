import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isRetryableDatabaseError } from "@/lib/reliability";

const TEST_ADMIN_EMAIL = "architecture-test-admin@example.com";

let testAdminCookie: string | null = null;

// A real database-backed, signed session fixture. Tests must opt into this
// explicitly by awaiting initTestAdmin and adding the resulting cookie;
// unauthenticated requests remain unauthenticated and production auth code has
// no test-only bypass.
export async function initTestAdmin(): Promise<void> {
  if (testAdminCookie) return;
  let testAdmin;
  for (let attempt = 0; ; attempt += 1) {
    try {
      testAdmin = await prisma.user.upsert({
        where: { email: TEST_ADMIN_EMAIL },
        update: { isAdmin: true, adminRole: "SUPER_ADMIN" },
        create: {
          email: TEST_ADMIN_EMAIL,
          name: "Architecture Test Admin",
          passwordHash: await hashPassword("architecture-test-only-password"),
          isAdmin: true,
          adminRole: "SUPER_ADMIN",
        },
      });
      break;
    } catch (error) {
      if (!isRetryableDatabaseError(error) || attempt >= 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100 * 2 ** attempt));
    }
  }
  testAdminCookie = `${SESSION_COOKIE}=${await createUserSessionToken(testAdmin.id)}`;
}

export function adminHeaders(headers: HeadersInit = {}): Headers {
  const result = new Headers(headers);
  if (!testAdminCookie) throw new Error("initTestAdmin() must run before adminHeaders()");
  result.set("cookie", testAdminCookie);
  return result;
}
