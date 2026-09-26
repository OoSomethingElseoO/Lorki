import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";
import { validateTextField, validateEmail, validateUrl } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as Partial<UpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail) {
    return apiContractError("VALIDATION_ERROR", "name, region, mission, website, and contactEmail are required", 400);
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

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return apiContractError("VALIDATION_ERROR", regionError, 400);
  }

  const missionError = validateTextField(body.mission, {
    minLength: 1,
    maxLength: 5000,
    name: "Mission",
  });
  if (missionError) {
    return apiContractError("VALIDATION_ERROR", missionError, 400);
  }

  const websiteError = validateUrl(body.website);
  if (websiteError) {
    return apiContractError("VALIDATION_ERROR", websiteError, 400);
  }

  const emailError = validateEmail(body.contactEmail);
  if (emailError) {
    return apiContractError("VALIDATION_ERROR", emailError, 400);
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

    await recordAudit({ action: "CONSERVANCY_UPDATED", affectedEntityType: "Conservancy", affectedEntityId: conservancy.id, reason: "Operations administrator updated a conservancy", changedBy: user!.email, metadata: { name: conservancy.name } });

    return NextResponse.json({ conservancy });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Conservancy not found", 404);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;

  try {
    const conservancy = await prisma.conservancy.delete({ where: { id } });
    await recordAudit({ action: "CONSERVANCY_DELETED", affectedEntityType: "Conservancy", affectedEntityId: id, reason: "Operations administrator deleted a conservancy", changedBy: user!.email, metadata: { name: conservancy.name } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Conservancy not found", 404);
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse(
        "This conservancy still has animals or campaigns linked to it — remove or reassign those first",
      );
    }
    throw error;
  }
}
