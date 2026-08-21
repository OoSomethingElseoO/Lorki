import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createCustomerSessionToken, CUSTOMER_SESSION_COOKIE } from "@/lib/customer-auth";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";

const SIGNUP_RATE_LIMIT = 5;
const SIGNUP_RATE_WINDOW_MS = 5 * 60 * 1000;

type SignupBody = {
  email: string;
  password: string;
  name?: string;
};

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(`account-signup:${ip}`, SIGNUP_RATE_LIMIT, SIGNUP_RATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });
  }

  const body = (await request.json()) as Partial<SignupBody>;

  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  if (body.password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({
      data: {
        email: body.email.toLowerCase().trim(),
        passwordHash: await hashPassword(body.password),
        name: body.name?.trim() || null,
      },
    });

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
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return uniqueConstraintResponse("An account with this email already exists");
    }
    throw error;
  }
}
