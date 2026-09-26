import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const conservancies = await prisma.conservancy.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ conservancies });
}

type CreateBody = {
  name: string;
  region: string;
  mission: string;
  website: string;
  contactEmail: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail) {
    return apiContractError("VALIDATION_ERROR", "name, region, mission, website, and contactEmail are required", 400);
  }

  const conservancy = await prisma.conservancy.create({
    data: {
      name: body.name,
      region: body.region,
      mission: body.mission,
      website: body.website,
      contactEmail: body.contactEmail,
      // An admin entering this by hand already is the vetting — unlike a
      // self-registered cause (see /api/cause/onboarding), which starts
      // unverified until an admin explicitly reviews it.
      verifiedAt: new Date(),
    },
  });

  await recordAudit({ action: "CONSERVANCY_CREATED", affectedEntityType: "Conservancy", affectedEntityId: conservancy.id, reason: "Operations administrator created a conservancy", changedBy: user!.email, metadata: { name: conservancy.name } });

  return NextResponse.json({ conservancy }, { status: 201 });
}
