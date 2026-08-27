import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";

type RouteParams = { params: Promise<{ id: string; artworkId: string }> };

type UpdateBody = {
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id, artworkId } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

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

  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (!artwork || artwork.campaignId !== id) {
    return NextResponse.json({ error: "Artwork not found on this campaign" }, { status: 404 });
  }

  try {
    const updated = await prisma.artwork.update({
      where: { id: artworkId },
      data: {
        title: body.title,
        kind: body.kind,
        priceCents: body.priceCents,
        imageUrl: body.imageUrl,
        altText: body.altText,
        story: body.story || null,
      },
    });

    return NextResponse.json({ artwork: updated });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id, artworkId } = await params;

  const artwork = await prisma.artwork.findUnique({ where: { id: artworkId } });
  if (!artwork || artwork.campaignId !== id) {
    return NextResponse.json({ error: "Artwork not found on this campaign" }, { status: 404 });
  }

  try {
    await prisma.artwork.delete({ where: { id: artworkId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This artwork already has orders against it and can't be deleted");
    }
    throw error;
  }
}
