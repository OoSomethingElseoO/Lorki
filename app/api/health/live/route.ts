import { NextResponse } from "next/server";

/** Process/container liveness: deliberately does not touch Postgres. */
export function GET(request: Request) {
  const requestId = request.headers.get("x-request-id");
  const response = NextResponse.json({ status: "ok", check: "liveness" });
  if (requestId) response.headers.set("x-request-id", requestId);
  return response;
}

