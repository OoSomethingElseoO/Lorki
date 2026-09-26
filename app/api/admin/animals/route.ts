import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { validateTextField, validateImageUrl } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
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
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.species || !body.region || !body.story || !body.imageUrl || !body.conservancyId) {
    return apiContractError("VALIDATION_ERROR", "name, species, region, story, imageUrl, and conservancyId are required", 400);
  }

  // ✅ Comprehensive validation
  const nameError = validateTextField(body.name, {
    minLength: 1,
    maxLength: 200,
    name: "Name",
  });
  if (nameError) {
    return apiContractError("VALIDATION_ERROR", nameError, 400);
  }

  const speciesError = validateTextField(body.species, {
    minLength: 1,
    maxLength: 100,
    name: "Species",
  });
  if (speciesError) {
    return apiContractError("VALIDATION_ERROR", speciesError, 400);
  }

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return apiContractError("VALIDATION_ERROR", regionError, 400);
  }

  const storyError = validateTextField(body.story, {
    minLength: 1,
    maxLength: 5000,
    name: "Story",
  });
  if (storyError) {
    return apiContractError("VALIDATION_ERROR", storyError, 400);
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return apiContractError("VALIDATION_ERROR", imageError, 400);
  }

  const conservancy = await prisma.conservancy.findUnique({ where: { id: body.conservancyId } });
  if (!conservancy) {
    return apiContractError("VALIDATION_ERROR", "conservancyId does not match an existing conservancy", 400);
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
