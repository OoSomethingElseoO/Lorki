// A campaign's "cause" is an Animal's conservancy (the wildlife-portrait
// case) or a directly-linked Conservancy (any other cause) — see the
// schema comment on Campaign and getCampaignConservancyId in lib/payouts.ts,
// which resolves the same either/or for payout purposes. This is the
// display-label equivalent: every admin/artist page that renders
// "{cause} × {artist}" should call this instead of assuming
// campaign.animal always exists.
export function getCampaignCauseName(campaign: {
  animal: { name: string } | null;
  conservancy: { name: string } | null;
}): string {
  return campaign.animal?.name ?? campaign.conservancy?.name ?? "Unknown cause";
}

export function getCampaignLabel(campaign: {
  animal: { name: string } | null;
  conservancy: { name: string } | null;
  artist: { name: string };
}): string {
  return `${getCampaignCauseName(campaign)} × ${campaign.artist.name}`;
}
