import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError, isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string; artworkId: string }> };

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
