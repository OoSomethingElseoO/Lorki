import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateTextField, validateEmail } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const coOps = await prisma.coOp.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ coOps });
}

type CreateBody = {
  name: string;
  region: string;
  contactEmail: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
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

  const coOp = await prisma.coOp.create({
    data: {
      name: body.name,
      region: body.region,
      contactEmail: body.contactEmail,
    },
  });

  await recordAudit({ action: "CO_OP_CREATED", affectedEntityType: "CoOp", affectedEntityId: coOp.id, reason: "Operations administrator created a co-op", changedBy: user!.email, metadata: { name: coOp.name } });

  return NextResponse.json({ coOp }, { status: 201 });
}
