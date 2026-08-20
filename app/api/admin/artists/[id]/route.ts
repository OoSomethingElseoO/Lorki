import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  foreignKeyConstraintResponse,
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintResponse,
} from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
  coOpId?: string;
  socialLinks?: { platform: string; url: string }[];
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return NextResponse.json({ error: "name, country, bio, and imageUrl are required" }, { status: 400 });
  }

  if (body.coOpId) {
    const coOp = await prisma.coOp.findUnique({ where: { id: body.coOpId } });
    if (!coOp) {
      return NextResponse.json({ error: "coOpId does not match an existing co-op" }, { status: 400 });
    }
  }

  const socialLinks = (body.socialLinks ?? []).filter((link) => link.platform && link.url);

  try {
    // Slug is set once at creation and stays fixed on edit — it's used in
    // public URLs and campaign slugs derive from it, so renaming an artist
    // must not silently break those.
    const artist = await prisma.$transaction(async (tx) => {
      await tx.socialLink.deleteMany({ where: { artistId: id } });

      return tx.artist.update({
        where: { id },
        data: {
          name: body.name,
          country: body.country,
          bio: body.bio,
          imageUrl: body.imageUrl,
          coOpId: body.coOpId || null,
          socialLinks: { create: socialLinks },
        },
        include: { socialLinks: true },
      });
    });

    return NextResponse.json({ artist });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An artist with this name already exists");
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    // Social links cascade-delete with the artist (no campaigns reference them).
    await prisma.socialLink.deleteMany({ where: { artistId: id } });
    await prisma.artist.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }
    if (isForeignKeyConstraintError(error)) {
      return foreignKeyConstraintResponse("This artist still has campaigns linked to them — remove those first");
    }
    throw error;
  }
}
