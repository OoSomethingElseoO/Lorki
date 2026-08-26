import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { attemptAutomaticPayout } from "@/lib/payout-channels";

type RouteParams = { params: Promise<{ id: string }> };

// FAILED only ever happens one way: processRefund or the Stripe webhook's
// handleDisputeCreated clawing back a still-PENDING payout on a refund or
// an open chargeback (see lib/refunds.ts and app/api/webhooks/stripe/route.ts
// — both deliberately never touch an already-RELEASED payout). Neither of
// those paths — nor a later handleDisputeClosed win — ever moves a FAILED
// payout forward again; both leave a comment saying an admin has to. This
// is that action: once an admin has confirmed the money is owed after all
// (the dispute was won, or the clawback turns out to have been wrong), it
// re-releases the payout and re-attempts automatic dispatch the same way a
// first release does on delivery — the underlying reason it's owed is
// identical. Deliberately no guard on the order's own disputedAt/status:
// same "trust the admin's judgment on the real-world facts" reasoning as
// the refund route.
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params;

  const payout = await prisma.payout.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          artwork: {
            include: {
              campaign: {
                include: { artist: true, conservancy: true, animal: { include: { conservancy: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!payout) {
    return NextResponse.json({ error: "Payout not found" }, { status: 404 });
  }

  if (payout.status !== "FAILED") {
    return NextResponse.json(
      { error: `Cannot revive — payout status is ${payout.status}, not FAILED` },
      { status: 409 },
    );
  }

  const updated = await prisma.payout.update({
    where: { id },
    data: { status: "RELEASED", releasedAt: new Date() },
  });

  // Best-effort, same as the deliver route — a failed automatic-dispatch
  // attempt must never roll back the revival itself.
  const campaign = payout.order.artwork.campaign;
  if (payout.recipientType === "ARTIST") {
    await attemptAutomaticPayout(payout.id, campaign.artist);
  } else if (payout.recipientType === "CONSERVANCY") {
    const conservancy = campaign.animal?.conservancy ?? campaign.conservancy;
    if (conservancy) {
      await attemptAutomaticPayout(payout.id, conservancy);
    }
  }

  return NextResponse.json({ payout: updated });
}
