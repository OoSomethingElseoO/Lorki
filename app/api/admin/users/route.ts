import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const users = await prisma.adminUser.findMany({
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
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const user = await prisma.adminUser.create({
      data: {
        name: body.name,
        email: body.email.toLowerCase().trim(),
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An admin with this email already exists");
    }
    throw error;
  }
}
