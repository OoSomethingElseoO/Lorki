import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  foreignKeyConstraintResponse,
  isForeignKeyConstraintError,
  isNotFoundError,
  isUniqueConstraintError,
  uniqueConstraintResponse,
} from "@/lib/prisma-errors";
import { validateTextField, validateCountryCode, validateImageUrl, validateUrl } from "@/lib/validation";
import { recordAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";

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
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.name || !body.country || !body.bio || !body.imageUrl) {
    return NextResponse.json({ error: "name, country, bio, and imageUrl are required" }, { status: 400 });
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

  const countryError = validateCountryCode(body.country);
  if (countryError) {
    return NextResponse.json({ error: countryError }, { status: 400 });
  }

  const bioError = validateTextField(body.bio, {
    minLength: 1,
    maxLength: 2000,
    name: "Bio",
  });
  if (bioError) {
    return NextResponse.json({ error: bioError }, { status: 400 });
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
  }

  if (body.coOpId) {
    const coOp = await prisma.coOp.findUnique({ where: { id: body.coOpId } });
    if (!coOp) {
      return NextResponse.json({ error: "coOpId does not match an existing co-op" }, { status: 400 });
    }
  }

  // ✅ Validate social links
  const socialLinks = (body.socialLinks ?? []).filter((link) => {
    if (!link.platform || !link.url) return false;
    const urlError = validateUrl(link.url);
    return !urlError;
  });

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

    await recordAudit({ action: "ARTIST_UPDATED", affectedEntityType: "Artist", affectedEntityId: artist.id, reason: "Operations administrator updated an artist record", changedBy: user!.email, metadata: { name: artist.name, coOpId: artist.coOpId } });

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
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const { id } = await params;

  try {
    // Social links cascade-delete with the artist (no campaigns reference them).
    await prisma.socialLink.deleteMany({ where: { artistId: id } });
    const artist = await prisma.artist.delete({ where: { id } });
    await recordAudit({ action: "ARTIST_DELETED", affectedEntityType: "Artist", affectedEntityId: id, reason: "Operations administrator deleted an artist record", changedBy: user!.email, metadata: { name: artist.name, coOpId: artist.coOpId } });
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
