import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  foreignKeyConstraintResponse,
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintResponse,
} from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  species: string;
  region: string;
  story: string;
  imageUrl: string;
  conservancyId: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.species || !body.region || !body.story || !body.imageUrl || !body.conservancyId) {
    return NextResponse.json(
      { error: "name, species, region, story, imageUrl, and conservancyId are required" },
      { status: 400 },
    );
  }

  const conservancy = await prisma.conservancy.findUnique({ where: { id: body.conservancyId } });
  if (!conservancy) {
    return NextResponse.json({ error: "conservancyId does not match an existing conservancy" }, { status: 400 });
  }

  try {
    // Slug is set once at creation and stays fixed on edit — it's used in
    // public URLs and campaign slugs derive from it, so renaming an animal
    // must not silently break those.
    const animal = await prisma.animal.update({
      where: { id },
      data: {
        name: body.name,
        species: body.species,
        region: body.region,
        story: body.story,
        imageUrl: body.imageUrl,
        conservancyId: body.conservancyId,
      },
    });

    return NextResponse.json({ animal });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Animal not found" }, { status: 404 });
    }
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An animal with this name already exists");
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.animal.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Animal not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This animal still has campaigns linked to it — remove those first");
    }
    throw error;
  }
}
