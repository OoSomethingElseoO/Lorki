import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail) {
    return NextResponse.json(
      { error: "name, region, mission, website, and contactEmail are required" },
      { status: 400 },
    );
  }

  try {
    const conservancy = await prisma.conservancy.update({
      where: { id },
      data: {
        name: body.name,
        region: body.region,
        mission: body.mission,
        website: body.website,
        contactEmail: body.contactEmail,
      },
    });

    return NextResponse.json({ conservancy });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Conservancy not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.conservancy.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Conservancy not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse(
        "This conservancy still has animals or campaigns linked to it — remove or reassign those first",
      );
    }
    throw error;
  }
}
