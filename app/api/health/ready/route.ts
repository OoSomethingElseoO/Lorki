import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** Dependency readiness: returns 503 when the database cannot answer. */
export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id");
  try {
    await prisma.$queryRaw`SELECT 1`;
    const response = NextResponse.json({ status: "ok", check: "readiness", dependencies: { database: "ok" } });
    if (requestId) response.headers.set("x-request-id", requestId);
    return response;
  } catch {
    const response = NextResponse.json(
      { status: "unavailable", check: "readiness", dependencies: { database: "unavailable" } },
      { status: 503 },
    );
    if (requestId) response.headers.set("x-request-id", requestId);
    return response;
  }
}

