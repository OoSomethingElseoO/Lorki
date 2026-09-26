import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slugify";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { validateTextField, validateImageUrl } from "@/lib/validation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { apiContractError } from "@/lib/api-contract";
import { readJsonObject } from "@/lib/request-json";

export async function GET(request: Request) {
  const { authorized } = checkPermission(await getCurrentUser(request), "OPS_ADMIN");
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
  const user = await getCurrentUser(request);
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");
  const body = await readJsonObject(request) as Partial<CreateBody> | null;
  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.title || !body.summary || !body.body || !body.imageUrl) {
    return apiContractError("VALIDATION_ERROR", "title, summary, body, and imageUrl are required", 400);
  }

  // ✅ Comprehensive validation
  const titleError = validateTextField(body.title, {
    minLength: 1,
    maxLength: 200,
    name: "Title",
  });
  if (titleError) {
    return apiContractError("VALIDATION_ERROR", titleError, 400);
  }

  const summaryError = validateTextField(body.summary, {
    minLength: 1,
    maxLength: 500,
    name: "Summary",
  });
  if (summaryError) {
    return apiContractError("VALIDATION_ERROR", summaryError, 400);
  }

  const bodyError = validateTextField(body.body, {
    minLength: 1,
    maxLength: 50000,
    name: "Body",
  });
  if (bodyError) {
    return apiContractError("VALIDATION_ERROR", bodyError, 400);
  }

  const imageError = validateImageUrl(body.imageUrl);
  if (imageError) {
    return apiContractError("VALIDATION_ERROR", imageError, 400);
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
