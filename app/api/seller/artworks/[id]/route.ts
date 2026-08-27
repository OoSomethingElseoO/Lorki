import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { foreignKeyConstraintResponse, isForeignKeyConstraintError } from "@/lib/prisma-errors";
import { isPriceTooLow, MIN_PRICE_CENTS } from "@/lib/pricing";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  title: string;
  kind: "ORIGINAL" | "PRINT";
  priceCents: number;
  imageUrl: string;
  altText: string;
  story?: string | null;
};

async function loadOwnArtwork(sellerId: string, artworkId: string) {
  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    include: { campaign: true },
  });
  if (!artwork || artwork.campaign.artistId !== sellerId) {
    return null;
  }
  return artwork;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwnArtwork(seller.id, id);
  if (!owned) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.title || !body.kind || typeof body.priceCents !== "number" || !body.imageUrl || !body.altText) {
    return NextResponse.json(
      { error: "title, kind, priceCents, imageUrl, and altText are required" },
      { status: 400 },
    );
  }

  if (owned.inventoryState === "SOLD") {
    return NextResponse.json({ error: "This piece has already sold and can no longer be edited" }, { status: 409 });
  }

  if (isPriceTooLow(body.priceCents)) {
    return NextResponse.json({ error: `priceCents must be at least ${MIN_PRICE_CENTS}` }, { status: 400 });
  }

  const artwork = await prisma.artwork.update({
    where: { id },
    data: {
      title: body.title,
      kind: body.kind,
      priceCents: body.priceCents,
      imageUrl: body.imageUrl,
      altText: body.altText,
      story: body.story || null,
    },
  });

  return NextResponse.json({ artwork });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { id } = await params;
  const owned = await loadOwnArtwork(seller.id, id);
  if (!owned) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  if (owned.inventoryState === "SOLD") {
    return NextResponse.json({ error: "This piece has already sold and can no longer be removed" }, { status: 409 });
  }

  try {
    await prisma.artwork.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This piece already has orders against it and can't be deleted");
    }
    throw error;
  }
}
