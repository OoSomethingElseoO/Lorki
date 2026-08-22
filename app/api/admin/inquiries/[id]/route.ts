import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isNotFoundError } from "@/lib/prisma-errors";

type RouteParams = { params: Promise<{ id: string }> };

type UpdateBody = {
  status: "NEW" | "CONTACTED" | "CLOSED";
};

const VALID_STATUSES = ["NEW", "CONTACTED", "CLOSED"];

export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
  const body = (await request.json()) as Partial<UpdateBody>;

  if (!body.status || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "status must be NEW, CONTACTED, or CLOSED" }, { status: 400 });
  }

  try {
    const inquiry = await prisma.inquiry.update({
      where: { id },
      data: { status: body.status },
    });

    return NextResponse.json({ inquiry });
  } catch (error) {
    if (isNotFoundError(error)) {
      return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
    }
    throw error;
  }
}
