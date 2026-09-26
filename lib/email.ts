import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getEmailFrom, getOperationsEmail, getResendApiKey, getSmtpConfig, getSettings, normalizeEmailTemplates, type SmtpConfig } from "@/lib/settings";
import { CircuitBreaker } from "@/lib/reliability";

type SendResult = { ok: true } | { ok: false; error: string };

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

async function sendTemplate(key: keyof ReturnType<typeof normalizeEmailTemplates>, to: string, variables: Record<string, string>): Promise<void> {
  const settings = await getSettings();
  const template = normalizeEmailTemplates(settings.emailTemplates)[key];
  const replace = (text: string) => text.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, name: string) => escapeHtml(variables[name] ?? ""));
  await sendEmail(to, replace(template.subject), `<p>${replace(template.body).replace(/\n/g, "</p><p>")}</p>`);
}

const resendCircuit = new CircuitBreaker(3, 30_000);

async function sendViaResend(apiKey: string, from: string, to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const response = await resendCircuit.run(() => fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // Email sends are deliberately not retried: unlike payout requests,
        // repeating this POST can duplicate a customer notification. The
        // circuit breaker prevents repeatedly paying the timeout cost while
        // SMTP remains the existing fallback.
        signal: AbortSignal.timeout(10_000),
        body: JSON.stringify({ from, to: [to], subject, html }),
      }));

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
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
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
  await sendTemplate("orderConfirmation", params.buyerEmail, { artworkTitle: params.artworkTitle, amount: `$${(params.amountCents / 100).toFixed(2)}` });
}

export async function sendShippingNotificationEmail(params: {
  buyerEmail: string;
  artworkTitle: string;
  carrier: string;
  trackingNumber?: string | null;
}) {
  const tracking = params.trackingNumber ? `${params.trackingNumber} (${params.carrier})` : `Shipped via ${params.carrier}`;
  await sendTemplate("shipping", params.buyerEmail, { artworkTitle: params.artworkTitle, tracking });
}

export async function sendPasswordResetEmail(params: { to: string; resetUrl: string }) {
  await sendEmail(
    params.to,
    "Reset your password",
    `<p>Someone requested a password reset for this account.</p><p><a href="${params.resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  );
}

export async function sendRefundConfirmationEmail(params: { buyerEmail: string; artworkTitle: string; amountCents: number }) {
  await sendTemplate("refund", params.buyerEmail, { artworkTitle: params.artworkTitle, amount: `$${(params.amountCents / 100).toFixed(2)}` });
}

export async function sendInquiryConfirmationEmail(params: { email: string; artworkTitle: string }) {
  await sendTemplate("inquiryConfirmation", params.email, { artworkTitle: params.artworkTitle });
}

export async function sendWelcomeEmail(to: string, siteName: string) { await sendTemplate("welcome", to, { siteName, productsUrl: "/products" }); }
export async function sendDeletionRequestedEmail(to: string, siteName: string) { await sendTemplate("deletionRequested", to, { siteName }); }
export async function sendDeletionDecisionEmail(to: string, decision: string, note: string) { await sendTemplate("deletionDecision", to, { decision, note }); }
export async function sendOfferNotificationEmail(to: string, artworkTitle: string, amount: string, decision?: string) { await sendTemplate(decision ? "offerDecision" : "offerSubmitted", to, { artworkTitle, amount, decision: decision ?? "received" }); }
export async function sendPayoutNotificationEmail(to: string, artworkTitle: string, amount: string, status: string) { await sendTemplate("payout", to, { artworkTitle, amount, status }); }
export async function sendWorkVisibilityEmail(to: string, count: number, action: string) { await sendTemplate("workVisibility", to, { count: String(count), action }); }
export async function sendMfaReminderEmail(to: string, siteName = "Lorki Originals") { await sendTemplate("mfaReminder", to, { siteName }); }
export async function sendMfaEmailOtp(to: string, code: string, siteName = "Lorki Originals") {
  await sendEmail(to, `${siteName} sign-in code`, `<p>Your one-time sign-in code is <strong>${escapeHtml(code)}</strong>.</p><p>It expires in 10 minutes. If you did not request this, change your password and contact support.</p>`);
}

export async function sendOperationsAlert(subject: string, html: string) {
  const operationsEmail = await getOperationsEmail();
  if (!operationsEmail) {
    console.error(`[ALERT:CRITICAL] Operations email not configured — alert not sent: "${subject}"`);
    return;
  }
  try {
    await sendEmail(operationsEmail, subject, html);
  } catch (error) {
    // sendEmail never throws, but if something unexpected happens, log it loudly
    console.error(`[ALERT:CRITICAL] Operations alert failed to send: "${subject}" — ${(error as Error).message}`);
  }
}
