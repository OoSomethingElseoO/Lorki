import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getStripe } from "@/lib/stripe";

// Kicks off Stripe's own hosted onboarding for a Standard connected
// account — Stripe collects and verifies the artist's identity/bank details
// directly, so this app never touches that data. Only usable by artists
// banking in a Stripe-supported country; Kenya-based artists use
// MPESA_FLUTTERWAVE instead (see /api/artist/payout-settings).
export async function POST(request: Request) {
  const currentUser = await getCurrentUser();
  const artist = currentUser?.artist;
  if (!artist) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe isn't configured yet" }, { status: 503 });
  }

  let accountId = artist.stripeConnectedAccountId;

  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "standard",
      email: currentUser.email,
    });
    accountId = account.id;
    await prisma.artist.update({
      where: { id: artist.id },
      data: { stripeConnectedAccountId: accountId, payoutChannel: "STRIPE_CONNECT" },
    });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${origin}/artist/profile`,
    return_url: `${origin}/api/artist/connect/return`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
