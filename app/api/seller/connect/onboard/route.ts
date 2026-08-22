import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

// Kicks off Stripe's own hosted onboarding for a Standard connected
// account — Stripe collects and verifies the artist's identity/bank details
// directly, so this app never touches that data. Only usable by artists
// banking in a Stripe-supported country; Kenya-based artists use
// MPESA_FLUTTERWAVE instead (see /api/seller/payout-settings).
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const seller = currentUser?.artist;
  if (!seller) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe isn't configured yet" }, { status: 503 });
  }

  let accountId = seller.stripeConnectedAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: currentUser.email,
    });
    accountId = account.id;
    await prisma.artist.update({
      where: { id: seller.id },
      data: { stripeConnectedAccountId: accountId, payoutChannel: "STRIPE_CONNECT" },
    });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/seller/profile`,
    return_url: `${origin}/api/seller/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
