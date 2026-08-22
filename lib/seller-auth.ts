import { cookies } from "next/headers";
import { createSessionToken, verifySessionToken } from "@/lib/session-token";
import { prisma } from "@/lib/prisma";

export const SELLER_SESSION_COOKIE = "lorki_seller_session";
const PURPOSE = "seller";

export async function createSellerSessionToken(artistId: string): Promise<string> {
  return createSessionToken(PURPOSE, artistId);
}

export async function verifySellerSessionToken(token: string | undefined | null): Promise<string | null> {
  return verifySessionToken(PURPOSE, token);
}

// For Server Components/route handlers — reads the cookie, verifies it, and
// confirms the artist record still exists. Returns null if not a logged-in
// seller.
export async function getCurrentSeller() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SELLER_SESSION_COOKIE)?.value;
  const artistId = await verifySellerSessionToken(token);
  if (!artistId) {
    return null;
  }
  return prisma.artist.findUnique({ where: { id: artistId } });
}
