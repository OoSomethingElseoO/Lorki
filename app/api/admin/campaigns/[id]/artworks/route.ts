import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

type RouteParams = { params: Promise<{ id: string }> };

type CreateBody = {
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return apiContractError("VALIDATION_ERROR", "title, kind, priceCents, imageUrl, and altText are required", 400);
  }

  if (body.kind !== "ORIGINAL" && body.kind !== "PRINT") {
    return apiContractError("VALIDATION_ERROR", "kind must be ORIGINAL or PRINT", 400);
  }

  if (isPriceTooLow(body.priceCents)) {
    return apiContractError("VALIDATION_ERROR", `priceCents must be at least ${MIN_PRICE_CENTS}`, 400);
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return apiContractError("NOT_FOUND", "Campaign not found", 404);
  }

  const artwork = await prisma.artwork.create({
    data: {
      campaignId: id,
      title: body.title,
      kind: body.kind,
      priceCents: body.priceCents,
      imageUrl: body.imageUrl,
      altText: body.altText,
      story: body.story || null,
    },
  });

  await recordAudit({ action: "ARTWORK_CREATED", affectedEntityType: "Artwork", affectedEntityId: artwork.id, reason: "Operations administrator created campaign artwork", changedBy: user!.email, metadata: { campaignId: id, title: artwork.title, kind: artwork.kind, priceCents: artwork.priceCents } });

  return NextResponse.json({ artwork }, { status: 201 });
}
