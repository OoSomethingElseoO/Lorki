import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission, unauthorized } from "@/lib/permissions";
import { readJsonObject } from "@/lib/request-json";
import { PRINT_SHIPPING_CENTS } from "@/lib/pricing";
import { MAX_PRICE_CENTS } from "@/lib/pricing";
import { sendOperationsAlert } from "@/lib/email";

type ImportRow = {
  externalId?: unknown;
  amountCents?: unknown;
  currency?: unknown;
  eventType?: unknown;
  observedAt?: unknown;
};

function isProvider(value: unknown): value is "STRIPE" | "FLUTTERWAVE" {
  return value === "STRIPE" || value === "FLUTTERWAVE";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  const { authorized } = checkPermission(user, "FINANCE_ADMIN");
  if (!authorized) return unauthorized("FINANCE_ADMIN");

  const body = await readJsonObject(request) as { provider?: unknown; rows?: unknown } | null;
  if (!body || !isProvider(body.provider) || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "provider and rows are required" }, { status: 400 });
  }
  if (body.rows.length > 1000) return NextResponse.json({ error: "Import is limited to 1000 rows" }, { status: 413 });

  const rows = body.rows as ImportRow[];
  let imported = 0;
  let duplicates = 0;
  let invalid = 0;
  let matched = 0;
  let mismatched = 0;
  const invalidRows: Array<{ externalId: string | null; reason: string }> = [];

  for (const row of rows) {
    if (!row || typeof row !== "object") {
      invalid += 1;
      if (invalidRows.length < 100) invalidRows.push({ externalId: null, reason: "row is not an object" });
      continue;
    }
    const externalId = typeof row.externalId === "string" ? row.externalId.trim() : "";
    const amountCents = typeof row.amountCents === "number" && Number.isInteger(row.amountCents) ? row.amountCents : null;
    const currency = typeof row.currency === "string" ? row.currency.trim().toLowerCase() : "";
    const eventType = typeof row.eventType === "string" && row.eventType.trim() ? row.eventType.trim() : "settlement.import";
    if (!externalId || amountCents === null || amountCents < 0 || amountCents > MAX_PRICE_CENTS + PRINT_SHIPPING_CENTS || !currency || currency.length > 10) {
      invalid += 1;
      if (invalidRows.length < 100) {
        invalidRows.push({
          externalId: externalId || null,
          reason: !externalId ? "missing externalId" : amountCents === null ? "amountCents must be an integer" : amountCents < 0 ? "negative amount" : amountCents > MAX_PRICE_CENTS + PRINT_SHIPPING_CENTS ? "amount exceeds sanity ceiling" : !currency ? "missing currency" : "invalid currency",
        });
      }
      continue;
    }

    const existing = await prisma.paymentReconciliation.findFirst({ where: { provider: body.provider, externalId, eventType }, select: { id: true } });
    if (existing) {
      duplicates += 1;
      continue;
    }

    if (body.provider === "STRIPE") {
      const order = await prisma.order.findUnique({ where: { stripePaymentIntentId: externalId }, include: { artwork: { select: { kind: true } } } });
      if (!order) {
        await prisma.paymentReconciliation.create({ data: { provider: body.provider, externalId, actualAmountCents: amountCents, actualCurrency: currency, status: "MISSING_LOCAL_ORDER", eventType, metadata: { source: "settlement_import" } } });
        imported += 1;
        mismatched += 1;
        continue;
      }
      const expectedAmountCents = order.amountCents + (order.artwork.kind === "PRINT" ? PRINT_SHIPPING_CENTS : 0);
      const amountMatches = expectedAmountCents === amountCents;
      const currencyMatches = order.currency.toLowerCase() === currency;
      const status = order.status !== "PAID"
        ? "MANUAL_REVIEW"
        : amountMatches && currencyMatches
          ? "MATCHED"
          : !currencyMatches
            ? "CURRENCY_MISMATCH"
            : "AMOUNT_MISMATCH";
      await prisma.paymentReconciliation.create({ data: { provider: body.provider, externalId, orderId: order.id, expectedAmountCents, actualAmountCents: amountCents, expectedCurrency: order.currency, actualCurrency: currency, differenceCents: amountCents - expectedAmountCents, status, eventType, observedAt: typeof row.observedAt === "string" && !Number.isNaN(Date.parse(row.observedAt)) ? new Date(row.observedAt) : new Date(), metadata: { source: "settlement_import" } } });
      imported += 1;
      if (status === "MATCHED") matched += 1; else mismatched += 1;
      continue;
    }

    const payout = await prisma.payout.findFirst({ where: { flutterwaveTransferId: externalId }, include: { order: { select: { currency: true } } } });
    if (!payout) {
      await prisma.paymentReconciliation.create({ data: { provider: body.provider, externalId, actualAmountCents: amountCents, actualCurrency: currency, status: "MISSING_LOCAL_ORDER", eventType, metadata: { source: "settlement_import" } } });
      imported += 1;
      mismatched += 1;
      continue;
    }
    const amountMatches = payout.amountCents === amountCents;
    const currencyMatches = payout.order.currency.toLowerCase() === currency;
    const status = amountMatches && currencyMatches ? "MATCHED" : !currencyMatches ? "CURRENCY_MISMATCH" : "PAYOUT_MISMATCH";
    await prisma.paymentReconciliation.create({ data: { provider: body.provider, externalId, payoutId: payout.id, expectedAmountCents: payout.amountCents, actualAmountCents: amountCents, expectedCurrency: payout.order.currency, actualCurrency: currency, differenceCents: amountCents - payout.amountCents, status, eventType, observedAt: typeof row.observedAt === "string" && !Number.isNaN(Date.parse(row.observedAt)) ? new Date(row.observedAt) : new Date(), metadata: { source: "settlement_import" } } });
    imported += 1;
    if (status === "MATCHED") matched += 1; else mismatched += 1;
  }

  await prisma.auditLog.create({
    data: {
      action: "PAYMENT_RECONCILIATION_IMPORTED",
      affectedEntityType: "PaymentReconciliation",
      affectedEntityId: "batch",
      reason: `Imported ${imported} ${body.provider} settlement rows`,
      changedBy: user!.email,
      metadata: { provider: body.provider, imported, duplicates, invalid, invalidRows, matched, mismatched },
    },
  });
  if (mismatched > 0 || invalid > 0) {
    sendOperationsAlert(
      `Payment reconciliation needs review: ${mismatched + invalid} ${body.provider} row(s)`,
      `<p>A settlement import produced <strong>${mismatched}</strong> non-matching and <strong>${invalid}</strong> rejected row(s) for ${body.provider}. Review the import audit entry and reconciliation dashboard.</p>`,
    ).catch((error) => console.error("[reconciliation:import-alert-failed]", error));
  }
  return NextResponse.json({ provider: body.provider, imported, duplicates, invalid, matched, mismatched });
}
