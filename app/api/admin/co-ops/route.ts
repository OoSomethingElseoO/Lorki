import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTextField, validateEmail } from "@/lib/validation";

export async function GET() {
  const coOps = await prisma.coOp.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coOps });
}

type CreateBody = {
  name: string;
  region: string;
  contactEmail: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.name || !body.region || !body.contactEmail) {
    return NextResponse.json({ error: "name, region, and contactEmail are required" }, { status: 400 });
  }

  // ✅ Comprehensive validation
  const nameError = validateTextField(body.name, {
    minLength: 1,
    maxLength: 200,
    name: "Name",
  });
  if (nameError) {
    return NextResponse.json({ error: nameError }, { status: 400 });
  }

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return NextResponse.json({ error: regionError }, { status: 400 });
  }

  const emailError = validateEmail(body.contactEmail);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
  }

  const coOp = await prisma.coOp.create({
    data: {
      name: body.name,
      region: body.region,
      contactEmail: body.contactEmail,
    },
  });

  return NextResponse.json({ coOp }, { status: 201 });
}
