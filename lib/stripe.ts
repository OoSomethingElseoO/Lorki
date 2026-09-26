import Stripe from "stripe";
import { getStripeSecretKey } from "@/lib/settings";

// Lazy on purpose: constructing this at module load (the old behavior) threw
// during import whenever no key was configured yet, which crashed every page
// that merely imported this module — including ones that only need Stripe
// conditionally (checkout/success). Callers await getStripe() only when they
// actually need to make a Stripe call.
export async function getStripe(): Promise<Stripe> {
  const secretKey = await getStripeSecretKey();

  if (!secretKey) {
    throw new Error("No Stripe secret key configured — set it in /admin/settings or STRIPE_SECRET_KEY");
  }

  // Stripe's SDK retries transient network failures. Payout calls also pass
  // an explicit idempotency key at the operation boundary, so a retry cannot
  // create a second transfer.
  return new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 15_000 });
}
