import { prisma } from "@/lib/prisma";
import { MarkPaidButton } from "@/components/admin/mark-paid-button";

export const dynamic = "force-dynamic";

function formatDollars(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

type PayoutChannelFields = {
  payoutChannel: string;
  payoutCountry: string | null;
  cryptoNetwork: string | null;
  cryptoAddress: string | null;
};

// Shared by the ARTIST and CONSERVANCY branches below — a cause is just a
// second kind of payout recipient with the identical field shape (see
// lib/payout-channels/types.ts), so its channel status reads the same way.
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

export default async function AdminPayoutsPage() {
  const payouts = await prisma.payout.findMany({
    where: { status: "RELEASED" },
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
    orderBy: { releasedAt: "desc" },
  });

  const unpaid = payouts.filter((p) => !p.paidOutAt);
  const totalsByType = { ARTIST: 0, CONSERVANCY: 0, OPERATIONS: 0 } as Record<string, number>;
  for (const p of unpaid) {
    totalsByType[p.recipientType] += p.amountCents;
  }

  function resolveConservancy(payout: (typeof payouts)[number]) {
    return payout.order.artwork.campaign.animal?.conservancy ?? payout.order.artwork.campaign.conservancy;
  }

  function recipientName(payout: (typeof payouts)[number]) {
    if (payout.recipientType === "ARTIST") return payout.order.artwork.campaign.artist.name;
    if (payout.recipientType === "CONSERVANCY") return resolveConservancy(payout)?.name ?? "Unknown cause";
    return "Operations";
  }

  function channelLabel(payout: (typeof payouts)[number]) {
    if (payout.recipientType === "ARTIST") {
      return describeChannel(payout.order.artwork.campaign.artist, payout);
    }
    if (payout.recipientType === "CONSERVANCY") {
      const conservancy = resolveConservancy(payout);
      return conservancy ? describeChannel(conservancy, payout) : "Manual";
    }
    return "Manual";
  }

  return (
    <>
      <h1>Payouts</h1>
      <p className="admin-form__hint">
        RELEASED means the buyer has the piece and this amount is cleared to pay — it does not by itself mean
        money has moved (see each row's channel). Sweep what's still unpaid into a separate holding account, pay
        recipients from there, then mark each one paid out here.
      </p>

      <div className="impact-totals">
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{formatDollars(totalsByType.ARTIST)}</span>
          <span className="impact-totals__label">Owed to artists, unpaid</span>
        </div>
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{formatDollars(totalsByType.CONSERVANCY)}</span>
          <span className="impact-totals__label">Owed to conservancies, unpaid</span>
        </div>
        <div className="impact-totals__stat">
          <span className="impact-totals__value">{formatDollars(totalsByType.OPERATIONS)}</span>
          <span className="impact-totals__label">Owed to operations, unpaid</span>
        </div>
      </div>

      <table className="admin-table">
        <thead>
          <tr>
            <th>Recipient</th>
            <th>Artwork</th>
            <th>Amount</th>
            <th>Channel</th>
            <th>Released</th>
            <th>Paid out</th>
          </tr>
        </thead>
        <tbody>
          {payouts.map((payout) => (
            <tr key={payout.id}>
              <td>
                {recipientName(payout)}
                <br />
                <span className="admin-form__hint">{payout.recipientType}</span>
              </td>
              <td>{payout.order.artwork.title}</td>
              <td>{formatDollars(payout.amountCents)}</td>
              <td>{channelLabel(payout)}</td>
              <td>{payout.releasedAt ? new Date(payout.releasedAt).toLocaleDateString() : "—"}</td>
              <td>
                {payout.paidOutAt ? (
                  new Date(payout.paidOutAt).toLocaleDateString()
                ) : (
                  <MarkPaidButton payoutId={payout.id} />
                )}
              </td>
            </tr>
          ))}
          {payouts.length === 0 ? (
            <tr>
              <td colSpan={6}>No released payouts yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
