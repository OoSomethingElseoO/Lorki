import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ReconciliationActions } from "@/components/admin/reconciliation-actions";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; status?: string; priority?: string; provider?: string }> };

export default async function ReconciliationPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!checkPermission(user, "FINANCE_ADMIN").authorized) redirect("/login?next=/admin/reconciliation");
  const filters = await searchParams;
  const currentPage = normalizeAdminPage(filters.page);
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const caseWhere = { observedAt: { gte: since }, ...(filters.status ? { status: filters.status as never } : {}), ...(filters.priority ? { priority: filters.priority as never } : {}), ...(filters.provider ? { provider: filters.provider as never } : {}) };
  const [cases, caseCount, failedEvents, eventCount, recentEvents, unmatchedOrders] = await Promise.all([
    prisma.paymentReconciliation.findMany({ where: caseWhere, orderBy: { observedAt: "desc" }, skip: (currentPage - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.paymentReconciliation.count({ where: caseWhere }),
    prisma.paymentProviderEvent.findMany({ where: { receivedAt: { gte: since }, status: "FAILED" }, orderBy: { receivedAt: "desc" }, take: 200 }),
    prisma.paymentProviderEvent.count({ where: { receivedAt: { gte: since } } }),
    prisma.paymentProviderEvent.findMany({ where: { receivedAt: { gte: since } }, orderBy: { receivedAt: "desc" }, take: 200 }),
    prisma.order.findMany({ where: { createdAt: { gte: since }, status: "PAID", stripePaymentIntentId: { not: null }, reconciliations: { none: {} } }, select: { id: true, stripePaymentIntentId: true, amountCents: true, currency: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 200 }),
  ]);
  const openCases = cases.filter((item) => item.status !== "RESOLVED");
  const casePages = adminTotalPages(caseCount);
  const extraQuery = new URLSearchParams({ ...(filters.status ? { status: filters.status } : {}), ...(filters.priority ? { priority: filters.priority } : {}), ...(filters.provider ? { provider: filters.provider } : {}) }).toString();

  return <>
    <h1>Payment reconciliation</h1>
    <p className="admin-form__hint">Rolling 30-day view. Provider events are immutable; discrepancies require a written resolution note.</p>
    <div className="impact-totals">
      <div className="impact-totals__stat"><span className="impact-totals__value">{openCases.length}</span><span className="impact-totals__label">Open cases</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{failedEvents.length}</span><span className="impact-totals__label">Failed provider events</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{eventCount}</span><span className="impact-totals__label">Provider events</span></div>
      <div className="impact-totals__stat"><span className="impact-totals__value">{unmatchedOrders.length}</span><span className="impact-totals__label">Paid orders without comparison</span></div>
    </div>
    <h2>Discrepancies</h2>
    <form method="get" className="admin-search-form"><select name="status" defaultValue={filters.status ?? ""}><option value="">All statuses</option><option value="MATCHED">Matched</option><option value="MANUAL_REVIEW">Manual review</option><option value="RESOLVED">Resolved</option><option value="AMOUNT_MISMATCH">Amount mismatch</option><option value="MISSING_LOCAL_ORDER">Missing local order</option></select><select name="priority" defaultValue={filters.priority ?? ""}><option value="">All priorities</option><option value="CRITICAL">Critical</option><option value="HIGH">High</option><option value="NORMAL">Normal</option><option value="LOW">Low</option></select><select name="provider" defaultValue={filters.provider ?? ""}><option value="">All providers</option><option value="STRIPE">Stripe</option><option value="FLUTTERWAVE">Flutterwave</option></select><button type="submit">Filter</button></form>
    <table className="admin-table"><thead><tr><th>Provider</th><th>External ID</th><th>Type</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Amounts</th><th>Observed</th><th /></tr></thead><tbody>
      {cases.map((item) => <tr key={item.id}><td>{item.provider}</td><td>{item.externalId ?? "—"}</td><td>{item.eventType ?? "—"}</td><td>{item.status}</td><td>{item.priority}</td><td>{item.assignedTo ?? "—"}</td><td>{item.expectedAmountCents ?? "—"} / {item.actualAmountCents ?? "—"}</td><td>{item.observedAt.toLocaleString()}</td><td><ReconciliationActions id={item.id} status={item.status} priority={item.priority} assignedTo={item.assignedTo} /></td></tr>)}
      {cases.length === 0 ? <tr><td colSpan={9}>No reconciliation cases in the last 30 days.</td></tr> : null}
    </tbody></table>
    <Pagination page={currentPage} totalPages={casePages} basePath="/admin/reconciliation" extraQuery={extraQuery} />
    <h2>Local payments without a comparison</h2>
    <p className="admin-form__hint">These orders have a recorded Stripe payment intent but no reconciliation row in the rolling window.</p>
    <table className="admin-table"><thead><tr><th>Order</th><th>Payment intent</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead><tbody>
      {unmatchedOrders.map((order) => <tr key={order.id}><td>{order.id}</td><td>{order.stripePaymentIntentId}</td><td>{order.currency.toUpperCase()} {(order.amountCents / 100).toFixed(2)}</td><td>{order.status}</td><td>{order.createdAt.toLocaleString()}</td></tr>)}
      {unmatchedOrders.length === 0 ? <tr><td colSpan={5}>Every local Stripe order has a reconciliation comparison.</td></tr> : null}
    </tbody></table>
    <h2>Provider event log</h2>
    <table className="admin-table"><thead><tr><th>Provider</th><th>External ID</th><th>Type</th><th>Status</th><th>Received</th><th>Processed</th><th>Error</th></tr></thead><tbody>
      {recentEvents.map((event) => <tr key={event.id}><td>{event.provider}</td><td>{event.externalId}</td><td>{event.eventType}</td><td>{event.status}</td><td>{event.receivedAt.toLocaleString()}</td><td>{event.processedAt?.toLocaleString() ?? "—"}</td><td>{event.error ?? "—"}</td></tr>)}
      {recentEvents.length === 0 ? <tr><td colSpan={7}>No provider events in the last 30 days.</td></tr> : null}
    </tbody></table>
    <h2>Failed provider events</h2>
    <table className="admin-table"><thead><tr><th>Provider</th><th>External ID</th><th>Type</th><th>Received</th><th>Error</th></tr></thead><tbody>
      {failedEvents.map((event) => <tr key={event.id}><td>{event.provider}</td><td>{event.externalId}</td><td>{event.eventType}</td><td>{event.receivedAt.toLocaleString()}</td><td>{event.error ?? "—"}</td></tr>)}
      {failedEvents.length === 0 ? <tr><td colSpan={5}>No failed provider events in the last 30 days.</td></tr> : null}
    </tbody></table>
  </>;
}
