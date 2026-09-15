import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { validateTextField, validateImageUrl } from "@/lib/validation";

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

  // ✅ Comprehensive validation
  const titleError = validateTextField(body.title, {
    minLength: 1,
    maxLength: 200,
    name: "Title",
  });
  if (titleError) {
    return NextResponse.json({ error: titleError }, { status: 400 });
  }

  const summaryError = validateTextField(body.summary, {
    minLength: 1,
    maxLength: 500,
    name: "Summary",
  });
  if (summaryError) {
    return NextResponse.json({ error: summaryError }, { status: 400 });
  }

  const bodyError = validateTextField(body.body, {
    minLength: 1,
    maxLength: 50000,
    name: "Body",
  });
  if (bodyError) {
    return NextResponse.json({ error: bodyError }, { status: 400 });
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return NextResponse.json({ error: imageError }, { status: 400 });
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
