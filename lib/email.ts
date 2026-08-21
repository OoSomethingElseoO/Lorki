import { getEmailFrom, getOperationsEmail, getResendApiKey } from "@/lib/settings";

// Best-effort transactional email via Resend's REST API. Deliberately never
// throws: a missing key or a failed send must not break checkout, the Stripe
// webhook, or order fulfillment — those are the flows that move money and
// inventory, and are far more important than a notification.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = await getResendApiKey();
  const from = await getEmailFrom();

  if (!apiKey) {
    console.log(`[email:skipped, no Resend key configured] to=${to} subject="${subject}"`);
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

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  await sendEmail(
    params.to,
    "Reset your password",
    `<p>Someone requested a password reset for this account.</p><p><a href="${params.resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  );
}

export async function sendOperationsAlert(subject: string, html: string) {
  const operationsEmail = await getOperationsEmail();
  if (!operationsEmail) {
    console.log(`[email:skipped, no operations email configured] subject="${subject}"`);
    return;
  }
  await sendEmail(operationsEmail, subject, html);
}
