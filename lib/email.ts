// Best-effort transactional email via Resend's REST API. Deliberately never
// throws: a missing RESEND_API_KEY or a failed send must not break checkout,
// the Stripe webhook, or order fulfillment — those are the flows that move
// money and inventory, and are far more important than a notification.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Lorkulup <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[email:skipped, no RESEND_API_KEY] to=${to} subject="${subject}"`);
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });

    if (!response.ok) {
      console.error(`[email:failed] to=${to} subject="${subject}" status=${response.status}`);
    }
  } catch (error) {
    console.error(`[email:failed] to=${to} subject="${subject}"`, error);
  }
}

export async function sendOrderConfirmationEmail(params: {
  buyerEmail: string;
  artworkTitle: string;
  amountCents: number;
}) {
  const amount = (params.amountCents / 100).toFixed(2);
  await sendEmail(
    params.buyerEmail,
    `Your order: ${params.artworkTitle}`,
    `<p>Thanks for your order.</p><p><strong>${params.artworkTitle}</strong> — $${amount}</p><p>We'll email you again once it ships.</p>`,
  );
}

export async function sendShippingNotificationEmail(params: {
  buyerEmail: string;
  artworkTitle: string;
  carrier: string;
  trackingNumber?: string | null;
}) {
  const tracking = params.trackingNumber
    ? `<p>Tracking number: ${params.trackingNumber} (${params.carrier})</p>`
    : `<p>Shipped via ${params.carrier}.</p>`;

  await sendEmail(
    params.buyerEmail,
    `Your order has shipped: ${params.artworkTitle}`,
    `<p><strong>${params.artworkTitle}</strong> is on its way.</p>${tracking}`,
  );
}

export async function sendOperationsAlert(subject: string, html: string) {
  const operationsEmail = process.env.OPERATIONS_EMAIL;
  if (!operationsEmail) {
    console.log(`[email:skipped, no OPERATIONS_EMAIL] subject="${subject}"`);
    return;
  }
  await sendEmail(operationsEmail, subject, html);
}
