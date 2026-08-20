import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from "@/lib/auth";
import { isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  // Never let the app lock itself out of /admin entirely.
  const totalAdmins = await prisma.adminUser.count();
  if (totalAdmins <= 1) {
    return NextResponse.json({ error: "Can't delete the last remaining admin" }, { status: 400 });
  }

  // Never let an admin delete their own account — avoids an accidental
  // self-lockout when they're the only one currently signed in.
  const cookieStore = await cookies();
  const currentAdminId = await verifyAdminSessionToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);

  if (currentAdminId === id) {
    return NextResponse.json({ error: "You can't delete your own account while signed in as it" }, { status: 400 });
  }

  try {
    await prisma.adminUser.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Admin user not found" }, { status: 404 });
    }
    throw error;
  }
}
