// Artist and Conservancy are two different Prisma models, but they share
// an identical payout-detail shape by design (see the schema comment on
// Conservancy) — a cause is just a second kind of payout recipient, not a
// different system. This structural type is what every channel module and
// the dispatcher actually operate on, so neither needs to care which
// concrete model it was given.
export type PayoutRecipient = {
  id: string;
  name: string;
  payoutChannel: string;
  payoutCountry: string | null;
  payoutCurrency: string | null;
  payoutMobileNetwork: string | null;
  payoutAccountNumber: string | null;
  payoutBankCode: string | null;
  stripeConnectedAccountId: string | null;
  stripeConnectOnboarded: boolean;
  cryptoNetwork: string | null;
  cryptoAddress: string | null;
};

export type PayoutAttemptInput = {
  recipient: PayoutRecipient;
  amountCents: number;
  currency: string;
  payoutId: string;
  orderId: string;
};

export type PayoutAttemptResult = {
  externalRef: string;
  // Provider-specific status string (e.g. Flutterwave's "NEW", Stripe's
  // transfer id existing at all meaning "paid" since transfers are
  // synchronous) — stored as-is for the admin to read, not parsed here.
  status: string;
  // True when the provider confirms the money has actually moved already
  // (Stripe transfers: immediately). False means "sent, awaiting async
  // confirmation" (Flutterwave: confirmed later via webhook) — the caller
  // only sets Payout.paidOutAt when this is true.
  settledImmediately: boolean;
};

// One module per rail implements this. Returning null means "this
// recipient isn't actually configured for automatic payout on this
// channel" (missing phone number, no connected account, no API key set) —
// the caller falls back to the same manual/tracked-obligation behavior as
// PayoutChannel.MANUAL, no error. Throwing means a real attempt was made
// and failed (a live API call errored) — the caller catches this, alerts
// an admin, and falls back the same way.
export type PayoutChannelHandler = (input: PayoutAttemptInput) => Promise<PayoutAttemptResult | null>;
