import { prisma } from "@/lib/prisma";
import { sendOperationsAlert } from "@/lib/email";
import { openSecurityCase } from "@/lib/security-cases";

const HOUR_MS = 60 * 60 * 1000;

export async function runSecurityAlertSweep() {
  const since = new Date(Date.now() - HOUR_MS);
  const [refunds, payoutActions, adminRevocations, criticalCases, missingLocal] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: "ORDER_REFUNDED" } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: { in: ["PAYOUT_MARKED_PAID_MANUAL", "PAYOUT_REVIVED"] } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: "ADMIN_ACCESS_REVOKED" } }),
    prisma.paymentReconciliation.count({ where: { observedAt: { gte: since }, priority: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.paymentReconciliation.count({ where: { observedAt: { gte: since }, status: "MISSING_LOCAL_ORDER" } }),
  ]);
  const reasons: string[] = [];
  if (refunds >= 3) reasons.push(`${refunds} refunds in the last hour`);
  if (payoutActions >= 3) reasons.push(`${payoutActions} payout overrides in the last hour`);
  if (adminRevocations > 0) reasons.push(`${adminRevocations} admin access revocation(s)`);
  if (criticalCases > 0) reasons.push(`${criticalCases} unresolved critical reconciliation case(s)`);
  if (missingLocal > 0) reasons.push(`${missingLocal} payment/payout event(s) without a local record`);
  if (reasons.length === 0) return { alerted: false, reasons: [] };

  type SecuritySignal = [string, string, "HIGH" | "CRITICAL", string, Record<string, number>];
  const signals: SecuritySignal[] = [];
  if (refunds >= 3) signals.push(["refund-spike", "FINANCIAL_ACTIVITY", "HIGH", `${refunds} refunds in the last hour`, { refunds }]);
  if (payoutActions >= 3) signals.push(["payout-override-spike", "FINANCIAL_ACTIVITY", "CRITICAL", `${payoutActions} payout overrides in the last hour`, { payoutActions }]);
  if (adminRevocations > 0) signals.push(["admin-revocation", "ADMIN_ACCESS", "HIGH", `${adminRevocations} admin access revocation(s)`, { adminRevocations }]);
  if (criticalCases > 0) signals.push(["critical-reconciliation", "RECONCILIATION", "CRITICAL", `${criticalCases} unresolved critical reconciliation case(s)`, { criticalCases }]);
  if (missingLocal > 0) signals.push(["missing-local-payment", "PAYMENT_INTEGRITY", "CRITICAL", `${missingLocal} payment/payout event(s) without a local record`, { missingLocal }]);
  await Promise.all(signals.map(([fingerprint, type, severity, summary, evidence]) => openSecurityCase({ fingerprint, type, severity, summary, evidence })));

  const existingAlert = await prisma.auditLog.findFirst({ where: { action: "SECURITY_THRESHOLD_ALERT_SENT", createdAt: { gte: since } }, select: { id: true } });
  if (existingAlert) return { alerted: false, deduplicated: true, reasons };
  const summary = reasons.join("; ");
  await sendOperationsAlert("QAForge security threshold alert", `<p>${summary}</p><p>Review the Activity and Reconciliation dashboards immediately.</p>`);
  await prisma.auditLog.create({ data: { action: "SECURITY_THRESHOLD_ALERT_SENT", affectedEntityType: "SecurityAlert", affectedEntityId: "hourly-thresholds", reason: summary, changedBy: "system", metadata: { since, refunds, payoutActions, adminRevocations, criticalCases, missingLocal } } });
  return { alerted: true, reasons };
}
