import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const { authorized } = checkPermission(await getCurrentUser(), "OPS_ADMIN");
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
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.name || !body.region || !body.mission || !body.website || !body.contactEmail) {
    return NextResponse.json(
      { error: "name, region, mission, website, and contactEmail are required" },
      { status: 400 },
    );
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
