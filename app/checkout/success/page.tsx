import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { buttonVariants } from "@/components/ui/button";
import { getStripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

type SuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { session_id: sessionId } = await searchParams;

  let heading = "Thank you for your order";
  let detail = "Your payment was received. A confirmation email is on its way.";

  if (sessionId) {
    try {
      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (session.payment_status === "paid") {
        const paymentIntentId =
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;

        // The Stripe webhook records the Order asynchronously and may not
        // have landed yet when the buyer is redirected back here — fall
        // back to Stripe's own session data rather than blocking on it.
        const order = paymentIntentId
          ? await prisma.order.findUnique({ where: { stripePaymentIntentId: paymentIntentId }, include: { artwork: true } })
          : null;

        const amount = ((session.amount_total ?? 0) / 100).toFixed(2);

        heading = order ? `Thank you for buying ${order.artwork.title}` : "Thank you for your order";
        detail = `We charged $${amount}. A confirmation email is on its way to ${session.customer_details?.email ?? "your inbox"}.`;
      } else {
        heading = "Payment processing";
        detail = "We're still confirming your payment. You'll get a confirmation email once it clears.";
      }
    } catch {
      // Invalid or expired session id — fall back to the generic message
      // rather than erroring the page.
    }
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Order confirmed</PageTitle>
        <div className="contact-card">
          <p>{heading}</p>
          <p>{detail}</p>
          <Link href="/originals" className={buttonVariants()}>
            Continue browsing
          </Link>
        </div>
      </main>
    </>
  );
}
