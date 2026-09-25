import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SecurityCaseActions } from "@/components/admin/security-case-actions";

export const dynamic = "force-dynamic";

export default async function AdminSecurityPage() {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) redirect("/login?next=/admin/security");
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [failedLogins, rateLimitedLogins, alerts, openCritical, revokedAdmins, cases] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: "LOGIN_FAILED" } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: "LOGIN_RATE_LIMITED" } }),
    prisma.auditLog.findMany({ where: { action: "SECURITY_THRESHOLD_ALERT_SENT" }, orderBy: { createdAt: "desc" }, take: 25 }),
    prisma.paymentReconciliation.count({ where: { priority: "CRITICAL", status: { not: "RESOLVED" } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: since }, action: "ADMIN_ACCESS_REVOKED" } }),
    prisma.securityCase.findMany({ where: { status: { not: "RESOLVED" } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  return <>
    <h1>Security overview</h1>
    <p className="admin-form__hint">Operational signals from the last 24 hours. This is an application view, not a replacement for external WAF, provider, database, or infrastructure logs.</p>
    <div className="impact-totals">
      <div className="impact-totals__stat"><span className="impact-totals__value">{failedLogins}</span><span className="impact-totals__label">Failed logins</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{rateLimitedLogins}</span><span className="impact-totals__label">Login rate limits</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{revokedAdmins}</span><span className="impact-totals__label">Admin revocations</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{openCritical}</span><span className="impact-totals__label">Open critical cases</span></div>
    </div>
    <p><Link href="/admin/activity">Review the full Activity Ledger</Link>{" · "}<Link href="/admin/reconciliation">Review reconciliation</Link></p>
    <h2>Threshold alerts</h2>
    <table className="admin-table"><thead><tr><th>When</th><th>Reason</th><th>Recorded by</th></tr></thead><tbody>
      {alerts.map((alert) => <tr key={alert.id}><td>{alert.createdAt.toLocaleString()}</td><td>{alert.reason}</td><td>{alert.changedBy}</td></tr>)}
      {alerts.length === 0 ? <tr><td colSpan={3}>No threshold alerts recorded.</td></tr> : null}
    </tbody></table>
    <h2>Security cases</h2>
    <table className="admin-table"><thead><tr><th>Created</th><th>Type</th><th>Severity</th><th>Status</th><th>Assigned</th><th>Summary</th><th /></tr></thead><tbody>
      {cases.map((item) => <tr key={item.id}><td>{item.createdAt.toLocaleString()}</td><td>{item.type}</td><td>{item.severity}</td><td>{item.status}</td><td>{item.assignedTo ?? "—"}</td><td>{item.summary}</td><td><SecurityCaseActions id={item.id} status={item.status} /></td></tr>)}
      {cases.length === 0 ? <tr><td colSpan={7}>No open security cases.</td></tr> : null}
    </tbody></table>
  </>;
}
