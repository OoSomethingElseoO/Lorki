import type { Campaign } from "@prisma/client";

// Applied to every self-service campaign a seller creates — deliberately
// not settable by the seller. Letting a seller pick their own split would
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
