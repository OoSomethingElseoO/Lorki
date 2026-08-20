import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNotFoundError, isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["DRAFT", "LIVE"] as const;

type UpdateBody = {
  title: string;
  summary: string;
  body: string;
  imageUrl: string;
  status: string;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  // Two shapes share this route: the full edit form (title/summary/body/
  // imageUrl) and the status-only toggle from the list page. Handle whichever
  // fields are present rather than requiring both at once.
  if (body.status !== undefined && !VALID_STATUSES.includes(body.status as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of ${VALID_STATUSES.join(", ")}` }, { status: 400 });
  }

  const hasContentFields = body.title !== undefined;
  if (hasContentFields && (!body.title || !body.summary || !body.body || !body.imageUrl)) {
    return NextResponse.json({ error: "title, summary, body, and imageUrl are required" }, { status: 400 });
  }

  const data: Record<string, string> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.title) data.title = body.title;
  if (body.summary) data.summary = body.summary;
  if (body.body) data.body = body.body;
  if (body.imageUrl) data.imageUrl = body.imageUrl;

  try {
    // Slug is set once at creation and stays fixed on edit — it's used in
    // the public article URL, so renaming a title must not break links.
    const article = await prisma.newsArticle.update({ where: { id }, data });
    return NextResponse.json({ article });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An article with this title already exists");
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  try {
    await prisma.newsArticle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }
    throw error;
  }
}
