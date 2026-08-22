import { NextResponse } from "next/server";
import { SELLER_SESSION_COOKIE } from "@/lib/seller-auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SELLER_SESSION_COOKIE);
  return response;
}
