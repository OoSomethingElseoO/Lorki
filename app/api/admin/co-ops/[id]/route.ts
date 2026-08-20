import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  region: string;
  contactEmail: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.region || !body.contactEmail) {
    return NextResponse.json({ error: "name, region, and contactEmail are required" }, { status: 400 });
  }

  try {
    const coOp = await prisma.coOp.update({
      where: { id },
      data: {
        name: body.name,
        region: body.region,
        contactEmail: body.contactEmail,
      },
    });

    return NextResponse.json({ coOp });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Co-op not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.coOp.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Co-op not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This co-op still has artists linked to it — remove those first");
    }
    throw error;
  }
}
