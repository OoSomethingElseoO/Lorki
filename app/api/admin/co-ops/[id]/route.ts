import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";
import { validateTextField, validateEmail } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  region: string;
  contactEmail: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as Partial<UpdateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.region || !body.contactEmail) {
    return apiContractError("VALIDATION_ERROR", "name, region, and contactEmail are required", 400);
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

  const emailError = validateEmail(body.contactEmail);
  if (emailError) {
    return apiContractError("VALIDATION_ERROR", emailError, 400);
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

    await recordAudit({ action: "CO_OP_UPDATED", affectedEntityType: "CoOp", affectedEntityId: coOp.id, reason: "Operations administrator updated a co-op", changedBy: user!.email, metadata: { name: coOp.name } });

    return NextResponse.json({ coOp });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Co-op not found", 404);
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
    const coOp = await prisma.coOp.delete({ where: { id } });
    await recordAudit({ action: "CO_OP_DELETED", affectedEntityType: "CoOp", affectedEntityId: id, reason: "Operations administrator deleted a co-op", changedBy: user!.email, metadata: { name: coOp.name } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return apiContractError("NOT_FOUND", "Co-op not found", 404);
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This co-op still has artists linked to it — remove those first");
    }
    throw error;
  }
}
