import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

// Stripe redirects the artist's browser here after hosted onboarding
// (whether they finished it or abandoned partway). account.updated in the
// Stripe webhook is the reliable long-term source of truth for
// stripeConnectOnboarded (it fires even if the artist closes the tab and
// finishes later via an emailed link) — this just gives instant feedback
// on the common case of returning right away.
export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  const origin = new URL(request.url).origin;

  if (!seller?.stripeConnectedAccountId) {
    return NextResponse.redirect(`${origin}/seller/profile`);
  }

  try {
    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(seller.stripeConnectedAccountId);
    await prisma.artist.update({
      where: { id: seller.id },
      data: { stripeConnectOnboarded: Boolean(account.payouts_enabled) },
    });
  } catch (error) {
    console.error("[seller/connect/return] Failed to refresh Connect account status", error);
  }

  return NextResponse.redirect(`${origin}/seller/profile`);
}
