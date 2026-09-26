import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createUserSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { isUniqueConstraintError, uniqueConstraintResponse } from "@/lib/prisma-errors";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { validateEmail, validatePassword } from "@/lib/validation";
import { readJsonObject } from "@/lib/request-json";
import { sendWelcomeEmail } from "@/lib/email";

// Creates a plain account — nothing more. Becoming an artist (linking an
// Artist profile) or an admin are separate, later steps on top of this
// same login, not different signup forms.
export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (await isRateLimited(`signup:${ip}`, 5, 5 * 60 * 1000)) {
    return apiContractError("RATE_LIMITED", "Too many signup attempts. Please try again in a few minutes.", 429);
  }

  const body = await readJsonObject(request) as Partial<{ name: string; email: string; password: string; passwordConfirmation: string }> | null;

  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.email || !body.password || !body.passwordConfirmation) {
    return apiContractError("INVALID_INPUT", "Email, password, and password confirmation are required", 400);
  }

  // ✅ Email validation
  const emailError = validateEmail(body.email);
  if (emailError) {
    return apiContractError("INVALID_EMAIL", emailError, 400, { field: "email" });
  }

  // ✅ Password validation
  const passwordError = validatePassword(body.password, { email: body.email, name: body.name });
  if (passwordError) {
    return apiContractError("INVALID_INPUT", passwordError, 400, { field: "password" });
  }
  if (body.password !== body.passwordConfirmation) {
    return apiContractError("INVALID_INPUT", "Passwords do not match", 400, { field: "passwordConfirmation" });
  }

  try {
    const passwordHash = await hashPassword(body.password);
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase().trim(),
        passwordHash,
        name: body.name || null,
        passwordHistory: { create: { passwordHash } },
      },
    });

    const token = await createUserSessionToken(user.id);
    sendWelcomeEmail(user.email, "Lorkulup").catch(() => undefined);
    const response = apiJson({ ok: true }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, {
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
