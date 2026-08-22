import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, verifyUserSessionToken } from "@/lib/auth";
import { isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

// "Delete" here means revoke admin access, not destroy the account — the
// target row is a shared identity that may also be a seller (linked
// Artist) or have real order history, so removing the row entirely would
// take those down with it. Setting isAdmin back to false is the correct
// operation; the account itself, and anything else attached to it, is
// untouched.
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || !target.isAdmin) {
    return NextResponse.json({ error: "Admin not found" }, { status: 404 });
  }

  // Never let the app lock itself out of /admin entirely.
  const totalAdmins = await prisma.user.count({ where: { isAdmin: true } });
  if (totalAdmins <= 1) {
    return NextResponse.json({ error: "Can't remove the last remaining admin" }, { status: 400 });
  }

  // Never let an admin remove their own access — avoids an accidental
  // self-lockout when they're the only one currently signed in.
  const cookieStore = await cookies();
  const currentUserId = await verifyUserSessionToken(cookieStore.get(SESSION_COOKIE)?.value);

  if (currentUserId === id) {
    return NextResponse.json({ error: "You can't remove your own admin access while signed in as it" }, { status: 400 });
  }

  try {
    await prisma.user.update({ where: { id }, data: { isAdmin: false } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Admin not found" }, { status: 404 });
    }
    throw error;
  }
}
