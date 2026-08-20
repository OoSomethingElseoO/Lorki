import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";

export const CUSTOMER_SESSION_COOKIE = "lorki_customer_session";
const PURPOSE = "customer";

export async function createCustomerSessionToken(customerId: string): Promise<string> {
  return createSessionToken(PURPOSE, customerId);
}

export async function verifyCustomerSessionToken(token: string | undefined | null): Promise<string | null> {
  return verifySessionToken(PURPOSE, token);
}

// For use in Server Components/route handlers (not middleware) — reads the
// cookie, verifies it, and confirms the customer still exists. Returns null
// for a guest visitor, same as if they were never logged in.
export async function getCurrentCustomer() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_SESSION_COOKIE)?.value;
  const customerId = await verifyCustomerSessionToken(token);
  if (!customerId) {
    return null;
  }
  return prisma.customer.findUnique({ where: { id: customerId } });
}
