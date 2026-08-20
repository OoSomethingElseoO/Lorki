import type { Campaign } from "@prisma/client";

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
