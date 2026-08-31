import type { Campaign, PayoutStatus } from "@prisma/client";

// A campaign benefits exactly one cause, reached one of two ways: through
// a specific Animal (derived as animal.conservancyId — the wildlife-
// portrait case) or directly (campaign.conservancyId — any other cause,
// no animal involved). Every payout-creating code path resolves it here
// rather than re-deriving this itself, so the two ways of expressing "who
// gets the conservancy's cut" never drift out of sync.
export function getCampaignConservancyId(campaign: {
  conservancyId: string | null;
  animal: { conservancyId: string } | null;
}): string {
  const conservancyId = campaign.animal?.conservancyId ?? campaign.conservancyId;
  if (!conservancyId) {
    throw new Error("Campaign has neither an animal nor a direct conservancyId — this should never happen");
  }
  return conservancyId;
}

// Applied to every self-service campaign an artist creates — deliberately
// not settable by the artist. Letting an artist pick their own split would
// let them quietly zero out the conservation cut, which is the entire
// point of the business. Admin can still hand-adjust a specific campaign's
// split after the fact via /admin/campaigns if there's a real reason to.
export const DEFAULT_SPLIT = {
  artistPercent: 50,
  conservancyPercent: 25,
  operationsPercent: 25,
} as const;

export type SplitAmounts = {
  artistCents: number;
  conservancyCents: number;
  operationsCents: number;
};

// Whole cents only; any remainder from rounding goes to operations so the
// three payout rows always sum exactly to amountCents.
export function computeSplit(
  amountCents: number,
  campaign: Pick<Campaign, "artistPercent" | "conservancyPercent" | "operationsPercent">,
): SplitAmounts {
  const artistCents = Math.floor((amountCents * campaign.artistPercent) / 100);
  const conservancyCents = Math.floor((amountCents * campaign.conservancyPercent) / 100);
  const operationsCents = amountCents - artistCents - conservancyCents;

  return { artistCents, conservancyCents, operationsCents };
}

// A payout can only be revived (see the revive route) from FAILED — that's
// the only status a payout ever ends up "stuck" in through no further
// action of its own (see the comment in the revive route for how FAILED
// happens). Pulled out of the route as a pure check so the decision itself
// is unit-testable without spinning up Next.js request/response machinery.
export function isPayoutRevivable(status: PayoutStatus): boolean {
  return status === "FAILED";
}
