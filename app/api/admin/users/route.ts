import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { validatePassword } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
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
  passwordConfirmation: string;
};

export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);
  const { authorized } = checkPermission(currentUser, "SUPER_ADMIN");
  if (!authorized) return unauthorized("SUPER_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.email || !body.password || !body.passwordConfirmation) {
    return apiContractError("VALIDATION_ERROR", "name, email, password, and password confirmation are required", 400);
  }

  const passwordError = validatePassword(body.password, { email: body.email, name: body.name });
  if (passwordError) {
    return apiContractError("VALIDATION_ERROR", passwordError, 400);
  }
  if (body.password !== body.passwordConfirmation) return apiContractError("VALIDATION_ERROR", "Passwords do not match", 400, { field: "passwordConfirmation" });

  try {
    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase().trim(),
        passwordHash,
        isAdmin: true,
        passwordHistory: { create: { passwordHash } },
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
