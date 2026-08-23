import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

type PayoutChannelFields = {
  payoutChannel: string;
  payoutCountry: string | null;
  cryptoNetwork: string | null;
  cryptoAddress: string | null;
};

function describeChannel(
  recipient: PayoutChannelFields,
  payout: { flutterwaveTransferStatus: string | null; stripeTransferId: string | null },
) {
  if (recipient.payoutChannel === "FLUTTERWAVE") {
    return `Flutterwave (${recipient.payoutCountry ?? "?"}) — ${payout.flutterwaveTransferStatus ?? "not sent"}`;
  }
  if (recipient.payoutChannel === "STRIPE_CONNECT") {
    return payout.stripeTransferId ? "Stripe Connect — transferred" : "Stripe Connect — not sent";
  }
  if (recipient.payoutChannel === "CRYPTO") {
    return `Crypto — send ${recipient.cryptoNetwork ?? "?"} to ${recipient.cryptoAddress ?? "?"}`;
  }
  return "Manual";
}

// Exports every RELEASED payout matching the same search as /admin/payouts,
// not just the current page — see the sibling orders export for why.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim();

  const where = query
    ? {
        status: "RELEASED" as const,
        OR: [
          { order: { artwork: { title: { contains: query, mode: "insensitive" as const } } } },
          { order: { artwork: { campaign: { artist: { name: { contains: query, mode: "insensitive" as const } } } } } },
          { order: { artwork: { campaign: { conservancy: { name: { contains: query, mode: "insensitive" as const } } } } } },
          {
            order: {
              artwork: { campaign: { animal: { conservancy: { name: { contains: query, mode: "insensitive" as const } } } } },
            },
          },
        ],
      }
    : { status: "RELEASED" as const };

  const payouts = await prisma.payout.findMany({
    where,
    include: {
      order: {
        include: {
          artwork: {
            include: { campaign: { include: { artist: true, conservancy: true, animal: { include: { conservancy: true } } } } },
          },
        },
      },
    },
    orderBy: { releasedAt: "desc" },
  });

  function resolveConservancy(payout: (typeof payouts)[number]) {
    return payout.order.artwork.campaign.animal?.conservancy ?? payout.order.artwork.campaign.conservancy;
  }

  function recipientName(payout: (typeof payouts)[number]) {
    if (payout.recipientType === "ARTIST") return payout.order.artwork.campaign.artist.name;
    if (payout.recipientType === "CONSERVANCY") return resolveConservancy(payout)?.name ?? "Unknown cause";
    return "Operations";
  }

  function channelLabel(payout: (typeof payouts)[number]) {
    if (payout.recipientType === "ARTIST") return describeChannel(payout.order.artwork.campaign.artist, payout);
    if (payout.recipientType === "CONSERVANCY") {
      const conservancy = resolveConservancy(payout);
      return conservancy ? describeChannel(conservancy, payout) : "Manual";
    }
    return "Manual";
  }

  const rows = [
    ["Payout ID", "Recipient type", "Recipient", "Artwork", "Amount (USD)", "Channel", "Released", "Paid out"],
    ...payouts.map((payout) => [
      payout.id,
      payout.recipientType,
      recipientName(payout),
      payout.order.artwork.title,
      (payout.amountCents / 100).toFixed(2),
      channelLabel(payout),
      payout.releasedAt ? payout.releasedAt.toISOString() : "",
      payout.paidOutAt ? payout.paidOutAt.toISOString() : "",
    ]),
  ];

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="payouts-export.csv"',
    },
  });
}
