import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { validateTextField, validateImageUrl } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

export async function GET() {
  const { authorized } = checkPermission(await getCurrentUser(), "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
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
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
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

    await recordAudit({ action: "NEWS_ARTICLE_CREATED", affectedEntityType: "NewsArticle", affectedEntityId: article.id, reason: "Operations administrator created a news article", changedBy: user!.email, metadata: { title: article.title, status: article.status } });

    return NextResponse.json({ article }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An article with this title already exists");
    }
    throw error;
  }
}
