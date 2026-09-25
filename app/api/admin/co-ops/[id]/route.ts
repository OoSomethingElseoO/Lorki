import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";
import { validateTextField, validateEmail } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  region: string;
  contactEmail: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.region || !body.contactEmail) {
    return NextResponse.json({ error: "name, region, and contactEmail are required" }, { status: 400 });
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

  const regionError = validateTextField(body.region, {
    minLength: 1,
    maxLength: 200,
    name: "Region",
  });
  if (regionError) {
    return NextResponse.json({ error: regionError }, { status: 400 });
  }

  const emailError = validateEmail(body.contactEmail);
  if (emailError) {
    return NextResponse.json({ error: emailError }, { status: 400 });
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
      return NextResponse.json({ error: "Co-op not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;

  try {
    const coOp = await prisma.coOp.delete({ where: { id } });
    await recordAudit({ action: "CO_OP_DELETED", affectedEntityType: "CoOp", affectedEntityId: id, reason: "Operations administrator deleted a co-op", changedBy: user!.email, metadata: { name: coOp.name } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Co-op not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This co-op still has artists linked to it — remove those first");
    }
    throw error;
  }
}
