import { prisma } from "@/lib/prisma";
import { MarkPaidButton } from "@/components/admin/mark-paid-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

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

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminPayoutsPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

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

  const includeShape = {
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
  } as const;

  // Totals reflect every unpaid RELEASED payout, not just the current
  // search/page — a summary of the whole outstanding obligation, browsing
  // the table below is a separate concern.
  const [payouts, totalCount, unpaidTotals] = await Promise.all([
    prisma.payout.findMany({
      where,
      include: includeShape,
      orderBy: { releasedAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.payout.count({ where }),
    prisma.payout.groupBy({
      by: ["recipientType"],
      where: { status: "RELEASED", paidOutAt: null },
      _sum: { amountCents: true },
    }),
  ]);

  const totalsByType = { ARTIST: 0, CONSERVANCY: 0, OPERATIONS: 0 } as Record<string, number>;
  for (const row of unpaidTotals) {
    totalsByType[row.recipientType] = row._sum.amountCents ?? 0;
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

      <AdminSearchForm placeholder="Search by artwork, artist, or cause name" defaultValue={query} />

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
              <td colSpan={6}>{query ? `No released payouts match "${query}".` : "No released payouts yet."}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/payouts"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
