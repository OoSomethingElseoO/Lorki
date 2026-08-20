import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const artists = await prisma.artist.findMany({
    include: { socialLinks: true, coOp: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ artists });
}

type CreateBody = {
  name: string;
  country: string;
  bio: string;
  imageUrl: string;
  coOpId?: string;
  socialLinks?: { platform: string; url: string }[];
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

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
    const artist = await prisma.artist.create({
      data: {
        slug: slugify(body.name),
        name: body.name,
        country: body.country,
        bio: body.bio,
        imageUrl: body.imageUrl,
        coOpId: body.coOpId || null,
        socialLinks: { create: socialLinks },
      },
      include: { socialLinks: true },
    });

    return NextResponse.json({ artist }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An artist with this name already exists");
    }
    throw error;
  }
}
