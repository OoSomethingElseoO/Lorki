import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";

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
  const { id } = await params;
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return NextResponse.json(
      { error: "title, kind, priceCents, imageUrl, and altText are required" },
      { status: 400 },
    );
  }

  if (body.kind !== "ORIGINAL" && body.kind !== "PRINT") {
    return NextResponse.json({ error: "kind must be ORIGINAL or PRINT" }, { status: 400 });
  }

  if (isPriceTooLow(body.priceCents)) {
    return NextResponse.json({ error: `priceCents must be at least ${MIN_PRICE_CENTS}` }, { status: 400 });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
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

  return NextResponse.json({ artwork }, { status: 201 });
}
