// Recommends a payout channel from an artist's own profile country — no
// detection needed, they already told us this when they set up their
// profile (Artist.country is free text, e.g. "Kenya"). Deliberately only
// covers countries actually verified (Stripe's global availability page;
// Flutterwave's published country coverage) rather than guessing at the
// other ~180 — an unverified guess here is worse than no recommendation at
// all, since the artist would trust it as authoritative for where their
// money goes.
export type PayoutRecommendation = {
  channel: "FLUTTERWAVE" | "STRIPE_CONNECT";
  note: string;
};

// Keyed on a normalized (lowercased, trimmed) country name, with a few
// common aliases — Artist.country is free text an artist typed in, not an
// ISO code, so matching has to tolerate that.
const RECOMMENDATIONS: Record<string, PayoutRecommendation> = {
  kenya: { channel: "FLUTTERWAVE", note: "Flutterwave pays out directly to M-Pesa in Kenya." },
  ethiopia: { channel: "FLUTTERWAVE", note: "Flutterwave supports M-Pesa (Safaricom Ethiopia) here." },
  "south africa": { channel: "FLUTTERWAVE", note: "Flutterwave pays out via bank transfer (EFT) in South Africa." },
  nigeria: { channel: "FLUTTERWAVE", note: "Flutterwave supports mobile money and bank transfer in Nigeria." },
  "united states": { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
  usa: { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
  us: { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
  canada: { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
  "united kingdom": { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
  uk: { channel: "STRIPE_CONNECT", note: "Stripe supports direct bank payouts here." },
};

export function recommendPayoutChannel(country: string | null | undefined): PayoutRecommendation | null {
  if (!country) {
    return null;
  }
  return RECOMMENDATIONS[country.trim().toLowerCase()] ?? null;
}
