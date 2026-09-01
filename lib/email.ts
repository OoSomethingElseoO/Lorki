import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getEmailFrom, getOperationsEmail, getResendApiKey, getSmtpConfig, type SmtpConfig } from "@/lib/settings";

type SendResult = { ok: true } | { ok: false; error: string };

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<SendResult> {
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
      return { ok: false, error: `Resend responded ${response.status}: ${await response.text().catch(() => "")}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function sendViaSmtp(config: SmtpConfig, from: string, to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
    await transporter.sendMail({ from, to, subject, html });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

async function logEmail(
  to: string,
  subject: string,
  provider: "RESEND" | "SMTP" | "NONE",
  status: "SENT" | "FAILED" | "SKIPPED",
  error: string | null,
): Promise<void> {
  try {
    await prisma.emailLog.create({ data: { to, subject, provider, status, error } });
  } catch (logError) {
    // The send itself already happened (or was skipped) by the time this
    // runs — a broken EmailLog write must not look like a broken send.
    console.error("[email:log-failed]", logError);
  }
}

// Best-effort transactional email. Deliberately never throws: a missing
// key/config or a failed send must not break checkout, the Stripe webhook,
// or order fulfillment — those are the flows that move money and
// inventory, and are far more important than a notification.
//
// Resend is tried first when configured; SMTP is the fallback, used when
// Resend isn't configured at all or a Resend attempt fails — not both
// unconditionally, since a customer getting the same order confirmation
// twice is worse than one channel occasionally covering for the other.
// Every attempt (sent, failed, or skipped entirely) is recorded in
// EmailLog — sendEmail never throwing means the console.log this used to
// rely on was the only record of whether anything actually went out, and
// that vanishes with the process.
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = await getEmailFrom();
  const resendApiKey = await getResendApiKey();
  const smtpConfig = await getSmtpConfig();

  if (resendApiKey) {
    const result = await sendViaResend(resendApiKey, from, to, subject, html);
    if (result.ok) {
      await logEmail(to, subject, "RESEND", "SENT", null);
      return;
    }
    console.error(`[email:resend-failed] to=${to} subject="${subject}" ${result.error}`);
    if (!smtpConfig) {
      await logEmail(to, subject, "RESEND", "FAILED", result.error);
      return;
    }
    // Fall through to the SMTP fallback below.
  }

  if (smtpConfig) {
    const result = await sendViaSmtp(smtpConfig, from, to, subject, html);
    if (!result.ok) {
      console.error(`[email:smtp-failed] to=${to} subject="${subject}" ${result.error}`);
    }
    await logEmail(to, subject, "SMTP", result.ok ? "SENT" : "FAILED", result.ok ? null : result.error);
    return;
  }

  console.log(`[email:skipped, no provider configured] to=${to} subject="${subject}"`);
  await logEmail(to, subject, "NONE", "SKIPPED", null);
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

export async function sendRefundConfirmationEmail(params: { buyerEmail: string; artworkTitle: string; amountCents: number }) {
  const amount = (params.amountCents / 100).toFixed(2);
  await sendEmail(
    params.buyerEmail,
    `Your refund: ${params.artworkTitle}`,
    `<p>Your order for <strong>${params.artworkTitle}</strong> ($${amount}) has been refunded.</p><p>If you paid by card, the refund should appear on your statement within a few business days.</p>`,
  );
}

export async function sendInquiryConfirmationEmail(params: { email: string; artworkTitle: string }) {
  await sendEmail(
    params.email,
    `We received your inquiry: ${params.artworkTitle}`,
    `<p>Thanks for your interest in <strong>${params.artworkTitle}</strong>.</p><p>This is a one-of-one original, so we arrange these sales personally — someone from our team will be in touch with you by email shortly to sort out payment and shipping.</p>`,
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
