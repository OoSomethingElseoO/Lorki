import { apiContractError, apiJson } from "@/lib/api-contract";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getRequestIp, isRateLimited } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";
import { PRINT_SHIPPING_CENTS } from "@/lib/pricing";
import { validateEmail } from "@/lib/validation";
import { checkIdempotency, storeIdempotencyResponse } from "@/lib/idempotency";
import { readJsonObject } from "@/lib/request-json";

type CheckoutBody = {
  artworkId: string;
  buyerEmail?: string;
};

// Caps how often one IP can create a Stripe Checkout session. Originals are
// deliberately reviewed first and use the inquiry/order workflow instead.
const CHECKOUT_RATE_LIMIT = 5;
const CHECKOUT_RATE_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  // ✅ Check for idempotent retry (prevent duplicate Stripe sessions)
  const customer = await getCurrentUser(request);
  const cached = await checkIdempotency(request, customer?.id);
  if (cached) return cached;

  const ip = getRequestIp(request);
  if (await isRateLimited(`checkout:${ip}`, CHECKOUT_RATE_LIMIT, CHECKOUT_RATE_WINDOW_MS)) {
    return apiContractError("RATE_LIMITED", "Too many checkout attempts. Please try again in a few minutes.", 429);
  }

  const body = await readJsonObject(request) as Partial<CheckoutBody> | null;

  if (!body) return apiContractError("INVALID_JSON", "Request body must be a JSON object", 400);

  if (!body.artworkId) {
    return apiContractError("INVALID_INPUT", "artworkId is required", 400, { field: "artworkId" });
  }

  // A logged-in buyer's email comes from their account, not the request
  // body — this is also what links the resulting Order back to them via
  // the webhook. Guests must supply an email explicitly.
  const buyerEmail = customer?.email ?? body.buyerEmail;

  // Guests enter their email on Stripe Checkout. Logged-in customers use the
  // verified email attached to their account.
  if (buyerEmail) {
    const emailError = validateEmail(buyerEmail);
    if (emailError) {
      return apiContractError("INVALID_EMAIL", emailError, 400, { field: "buyerEmail" });
    }
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return apiContractError("PAYMENTS_UNAVAILABLE", "Checkout isn't configured yet — no Stripe key is set", 503);
  }

  const artwork = await prisma.artwork.findUnique({ where: { id: body.artworkId } });

  if (!artwork) {
    return apiContractError("NOT_FOUND", "Artwork not found", 404);
  }

  if (artwork.inventoryState !== "AVAILABLE") {
    return apiContractError("ARTWORK_UNAVAILABLE", "Artwork is not available", 409);
  }

  if (artwork.kind === "ORIGINAL") {
    return apiContractError("APPROVAL_REQUIRED", "Originals require approval before payment. Please submit an inquiry.", 409);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      ...(buyerEmail ? { customer_email: buyerEmail } : { customer_creation: "always" as const }),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: artwork.currency,
            unit_amount: artwork.priceCents,
            product_data: { name: artwork.title },
          },
        },
      ],
      shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "KE"] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: { amount: PRINT_SHIPPING_CENTS, currency: artwork.currency },
            display_name: "Standard shipping",
          },
        },
      ],
      metadata: { artworkId: artwork.id, ...(customer ? { customerId: customer.id } : {}) },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout/cancelled`,
    });

    const response = apiJson({ url: session.url });
    // ✅ Store idempotency response for future retries
    await storeIdempotencyResponse(
      request.headers.get("Idempotency-Key"),
      customer?.id,
      200,
      { url: session.url }
    ).catch((e) => console.error("[idempotency:storage-failed]", e));
    return response;
  } catch (error) {
    console.error("[checkout] Stripe session creation failed", error);
    const errorResponse = apiContractError("CHECKOUT_FAILED", "Checkout is temporarily unavailable. Please try again.", 502);
    // ✅ Store error response for idempotency (prevent retry storms)
    await storeIdempotencyResponse(
      request.headers.get("Idempotency-Key"),
      customer?.id,
      502,
      { error: "Checkout is temporarily unavailable. Please try again." }
    ).catch((e) => console.error("[idempotency:storage-failed]", e));
    return errorResponse;
  }
}
