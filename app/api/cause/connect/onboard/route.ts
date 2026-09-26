import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";
import { conservancyRequired } from "@/lib/authorization";
import { apiContractError } from "@/lib/api-contract";

// Conservancy-side mirror of /api/artist/connect/onboard — kicks off
// Stripe's own hosted onboarding for a Standard connected account. Only
// usable by a cause banking in a Stripe-supported country; others use
// FLUTTERWAVE instead (see /api/cause/payout-settings).
export async function POST(request: Request) {
  const currentUser = await getCurrentUser(request);
  const cause = conservancyRequired(currentUser);
  if (!currentUser || !cause) {
    return apiContractError("UNAUTHORIZED", "Not signed in", 401);
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return apiContractError("SERVICE_UNAVAILABLE", "Stripe isn't configured yet", 503);
  }

  let accountId = cause.stripeConnectedAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: currentUser.email,
    });
    accountId = account.id;
    await prisma.conservancy.update({
      where: { id: cause.id },
      data: { stripeConnectedAccountId: accountId, payoutChannel: "STRIPE_CONNECT" },
    });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/cause/profile`,
    return_url: `${origin}/api/cause/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
