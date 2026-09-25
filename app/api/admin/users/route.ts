import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "SUPER_ADMIN");
  if (!authorized) return unauthorized("SUPER_ADMIN");
  const users = await prisma.user.findMany({
    where: { isAdmin: true },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ users });
}

type CreateBody = {
  name: string;
  email: string;
  password: string;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const { authorized } = checkPermission(currentUser, "SUPER_ADMIN");
  if (!authorized) return unauthorized("SUPER_ADMIN");
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase().trim(),
        passwordHash: await hashPassword(body.password),
        isAdmin: true,
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    await recordAudit({ action: "ADMIN_ACCESS_GRANTED", affectedEntityType: "User", affectedEntityId: user.id, reason: "Super administrator created an admin account", changedBy: currentUser!.email, metadata: { targetEmail: user.email } });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An account with this email already exists");
    }
    throw error;
  }
}
