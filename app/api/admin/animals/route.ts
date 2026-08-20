import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const animals = await prisma.animal.findMany({
    include: { conservancy: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ animals });
}

type CreateBody = {
  name: string;
  species: string;
  region: string;
  story: string;
  imageUrl: string;
  conservancyId: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

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
    const animal = await prisma.animal.create({
      data: {
        slug: slugify(body.name),
        name: body.name,
        species: body.species,
        region: body.region,
        story: body.story,
        imageUrl: body.imageUrl,
        conservancyId: body.conservancyId,
      },
    });

    return NextResponse.json({ animal }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An animal with this name already exists");
    }
    throw error;
  }
}
