import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

// Stripe redirects the cause's browser here after hosted onboarding.
// account.updated in the Stripe webhook is the reliable long-term source
// of truth for stripeConnectOnboarded (fires even if they close the tab
// and finish later via an emailed link) — this just gives instant
// feedback on the common case of returning right away.
export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const cause = currentUser?.conservancy;
  const origin = new URL(request.url).origin;

  if (!cause?.stripeConnectedAccountId) {
    return NextResponse.redirect(`${origin}/cause/profile`);
  }

  try {
    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(cause.stripeConnectedAccountId);
    await prisma.conservancy.update({
      where: { id: cause.id },
      data: { stripeConnectOnboarded: Boolean(account.payouts_enabled) },
    });
  } catch (error) {
    console.error("[cause/connect/return] Failed to refresh Connect account status", error);
  }

  return NextResponse.redirect(`${origin}/cause/profile`);
}
