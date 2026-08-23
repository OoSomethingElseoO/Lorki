import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

// Public, unauthenticated — these serve artwork images and similar content
// shown to any storefront visitor, the same visibility a static file under
// public/uploads always had. Long, immutable cache: each upload gets its
// own id and is never modified in place, so there's never a staleness risk.
export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const file = await prisma.uploadedFile.findUnique({ where: { id } });
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(file.data, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
