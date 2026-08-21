import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

const LOGIN_RATE_LIMIT = 5;
const LOGIN_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`account-login:${ip}`, LOGIN_RATE_LIMIT, LOGIN_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many login attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<{ email: string; password: string }>;

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { email: body.email.toLowerCase().trim() } });

  if (!customer || !(await verifyPassword(body.password, customer.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
  }

  const token = await createCustomerSessionToken(customer.id);
  const response = NextResponse.json({ ok: true });

  response.cookies.set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
