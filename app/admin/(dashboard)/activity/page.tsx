import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string; action?: string; actor?: string; entity?: string }> };

function entityHref(type: string, id: string) {
  if (type === "Order") return `/admin/orders?q=${encodeURIComponent(id)}`;
  if (type === "PaymentReconciliation") return `/admin/reconciliation?q=${encodeURIComponent(id)}`;
  if (type === "Offer") return `/admin/offers?q=${encodeURIComponent(id)}`;
  if (type === "Payout") return `/admin/payouts?q=${encodeURIComponent(id)}`;
  return null;
}

export default async function AdminActivityPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) redirect("/login?next=/admin/activity");
  const { page, q, action, actor, entity } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();
  const where = {
    ...(action?.trim() ? { action: { contains: action.trim(), mode: "insensitive" as const } } : {}),
    ...(actor?.trim() ? { changedBy: { contains: actor.trim(), mode: "insensitive" as const } } : {}),
    ...(entity?.trim() ? { affectedEntityType: entity.trim() } : {}),
    ...(query ? { OR: [
      { action: { contains: query, mode: "insensitive" as const } },
      { affectedEntityId: { contains: query, mode: "insensitive" as const } },
      { reason: { contains: query, mode: "insensitive" as const } },
      { changedBy: { contains: query, mode: "insensitive" as const } },
    ] } : {}),
  };
  const [entries, totalCount] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (currentPage - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.auditLog.count({ where }),
  ]);
  const totalPages = adminTotalPages(totalCount);
  const extraQuery = new URLSearchParams({ ...(q ? { q } : {}), ...(action ? { action } : {}), ...(actor ? { actor } : {}), ...(entity ? { entity } : {}) }).toString();
  return <>
    <h1>Activity ledger</h1>
    <p className="admin-form__hint">Append-only audit entries for privileged financial, offer, reconciliation, and operational actions. This is not an access log or a record of every public read.</p>
    <form method="get" className="admin-search-form"><input name="q" defaultValue={q} placeholder="Search action, ID, reason, or operator" /><input name="action" defaultValue={action} placeholder="Action type" /><input name="actor" defaultValue={actor} placeholder="Operator email" /><input name="entity" defaultValue={entity} placeholder="Entity type" /><button type="submit">Filter</button></form>
    <table className="admin-table"><thead><tr><th>When</th><th>Action</th><th>Entity</th><th>Changed by</th><th>Reason</th></tr></thead><tbody>
      {entries.map((entry) => { const href = entityHref(entry.affectedEntityType, entry.affectedEntityId); return <tr key={entry.id}><td>{entry.createdAt.toLocaleString()}</td><td>{entry.action}</td><td>{href ? <Link href={href}>{entry.affectedEntityType} / {entry.affectedEntityId}</Link> : `${entry.affectedEntityType} / ${entry.affectedEntityId}`}</td><td>{entry.changedBy}</td><td>{entry.reason}</td></tr>; })}
      {entries.length === 0 ? <tr><td colSpan={5}>No audit entries yet.</td></tr> : null}
    </tbody></table>
    <Pagination page={currentPage} totalPages={totalPages} basePath="/admin/activity" extraQuery={extraQuery} />
  </>;
}
