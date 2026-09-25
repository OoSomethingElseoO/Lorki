import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { validateTextField, validateImageUrl } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const { authorized } = checkPermission(await getCurrentUser(), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
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
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.name || !body.species || !body.region || !body.story || !body.imageUrl || !body.conservancyId) {
    return NextResponse.json(
      { error: "name, species, region, story, imageUrl, and conservancyId are required" },
      { status: 400 },
    );
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

  const speciesError = validateTextField(body.species, {
    minLength: 1,
    maxLength: 100,
    name: "Species",
  });
  if (speciesError) {
    return NextResponse.json({ error: speciesError }, { status: 400 });
  }

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return NextResponse.json({ error: regionError }, { status: 400 });
  }

  const storyError = validateTextField(body.story, {
    minLength: 1,
    maxLength: 5000,
    name: "Story",
  });
  if (storyError) {
    return NextResponse.json({ error: storyError }, { status: 400 });
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
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

    await recordAudit({ action: "ANIMAL_CREATED", affectedEntityType: "Animal", affectedEntityId: animal.id, reason: "Operations administrator created an animal record", changedBy: user!.email, metadata: { name: animal.name, conservancyId: animal.conservancyId } });

    return NextResponse.json({ animal }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An animal with this name already exists");
    }
    throw error;
  }
}
