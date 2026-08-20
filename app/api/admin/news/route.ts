import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

export async function GET() {
  const articles = await prisma.newsArticle.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ articles });
}

type CreateBody = {
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
};

export async function POST(request: Request) {
  const body = (await request.json()) as Partial<CreateBody>;

  if (!body.title || !body.summary || !body.body || !body.imageUrl) {
    return NextResponse.json({ error: "title, summary, body, and imageUrl are required" }, { status: 400 });
  }

  try {
    const article = await prisma.newsArticle.create({
      data: {
        slug: slugify(body.title),
        title: body.title,
        summary: body.summary,
        body: body.body,
        imageUrl: body.imageUrl,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An article with this title already exists");
    }
    throw error;
  }
}
