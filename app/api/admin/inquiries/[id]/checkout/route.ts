import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

type RouteParams = { params: Promise<{ id: string }> };

// Payment cannot start until an authorized operator explicitly approves the
// original inquiry. The public checkout route rejects ORIGINAL artworks.
export async function POST(request: Request, { params }: RouteParams) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "OPS_ADMIN");
  if (!authorized) return unauthorized("OPS_ADMIN");

  const { id } = await params;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: { artwork: true },
  });

  if (!inquiry) return NextResponse.json({ error: "Inquiry not found" }, { status: 404 });
  if (inquiry.status !== "APPROVED") {
    return NextResponse.json({ error: "Inquiry must be approved before payment starts" }, { status: 409 });
  }
  if (inquiry.artwork.kind !== "ORIGINAL" || inquiry.artwork.inventoryState !== "RESERVED") {
    return NextResponse.json({ error: "This original is no longer reserved" }, { status: 409 });
  }

  let stripe;
  try {
    stripe = await getStripe();
  } catch {
    return NextResponse.json({ error: "Stripe isn't configured yet" }, { status: 503 });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: inquiry.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: inquiry.artwork.currency,
        unit_amount: inquiry.artwork.priceCents,
        product_data: { name: inquiry.artwork.title },
      },
    }],
    shipping_address_collection: { allowed_countries: ["US", "CA", "GB", "KE"] },
    metadata: { artworkId: inquiry.artwork.id, inquiryId: inquiry.id },
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/checkout/cancelled`,
  });

  await recordAudit({ action: "INQUIRY_PAYMENT_LINK_CREATED", affectedEntityType: "Inquiry", affectedEntityId: id, reason: "Operations administrator created a Stripe payment link for an approved inquiry", changedBy: user!.email, metadata: { artworkId: inquiry.artwork.id, stripeCheckoutSessionId: session.id, amountCents: inquiry.artwork.priceCents } });

  return NextResponse.json({ url: session.url });
}
