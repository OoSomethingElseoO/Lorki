import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; targetType?: string; channel?: string; targetId?: string; from?: string; to?: string }> };

function dateValue(value: string | undefined, endOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function ShareAnalyticsPage({ searchParams }: PageProps) {
  const user = await getCurrentUser();
  if (!checkPermission(user, "OPS_ADMIN").authorized) redirect("/login?next=/admin/share-analytics");
  const params = await searchParams;
  const page = normalizeAdminPage(params.page);
  const targetType = params.targetType?.trim();
  const channel = params.channel?.trim();
  const targetId = params.targetId?.trim();
  const from = params.from?.trim();
  const to = params.to?.trim();
  const fromDate = dateValue(from);
  const toDate = dateValue(to, true);
  const where = {
    ...(targetType ? { targetType } : {}),
    ...(channel ? { channel } : {}),
    ...(targetId ? { targetId: { contains: targetId, mode: "insensitive" as const } } : {}),
    ...(fromDate || toDate ? { createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
  };
  const [events, total, groupedTargets, groupedChannels] = await Promise.all([
    prisma.shareEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * ADMIN_PAGE_SIZE, take: ADMIN_PAGE_SIZE }),
    prisma.shareEvent.count({ where }),
    prisma.shareEvent.groupBy({ by: ["targetType"], where, _count: { _all: true }, orderBy: { _count: { targetType: "desc" } } }),
    prisma.shareEvent.groupBy({ by: ["channel"], where, _count: { _all: true }, orderBy: { _count: { channel: "desc" } } }),
  ]);
  const totalPages = adminTotalPages(total);
  const extraQuery = new URLSearchParams({ ...(targetType ? { targetType } : {}), ...(channel ? { channel } : {}), ...(targetId ? { targetId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString();
  return <>
    <div className="admin-page-heading"><div><h1>Share analytics</h1><p className="admin-form__hint">Understand which artwork, artist, and campaign pages visitors share. This is analytics, not a financial audit ledger.</p></div><strong>{total.toLocaleString()} shares</strong></div>
    <form method="get" className="admin-search-form">
      <select name="targetType" defaultValue={targetType ?? ""}><option value="">All targets</option><option value="artwork">Artwork</option><option value="artist">Artist</option><option value="campaign">Campaign</option></select>
      <select name="channel" defaultValue={channel ?? ""}><option value="">All channels</option><option value="native">Native share</option><option value="clipboard">Clipboard</option><option value="unknown">Unknown</option></select>
      <input name="targetId" defaultValue={targetId} placeholder="Target ID" />
      <label>From <input type="date" name="from" defaultValue={from} /></label><label>To <input type="date" name="to" defaultValue={to} /></label>
      <button type="submit">Filter</button>{extraQuery ? <Link href="/admin/share-analytics">Clear</Link> : null}
    </form>
    <div className="admin-summary-grid">
      {groupedTargets.map((item) => <div className="admin-summary-card" key={item.targetType}><span>{item.targetType} shares</span><strong>{item._count._all.toLocaleString()}</strong></div>)}
      {groupedChannels.map((item) => <div className="admin-summary-card" key={`channel-${item.channel}`}><span>{item.channel} shares</span><strong>{item._count._all.toLocaleString()}</strong></div>)}
    </div>
    <table className="admin-table"><thead><tr><th>When</th><th>Target</th><th>Channel</th><th>User</th></tr></thead><tbody>
      {events.map((event) => <tr key={event.id}><td>{event.createdAt.toLocaleString()}</td><td>{event.targetType} / <code>{event.targetId}</code></td><td>{event.channel}</td><td>{event.userId ? <code>{event.userId}</code> : "Anonymous visitor"}</td></tr>)}
      {events.length === 0 ? <tr><td colSpan={4}>No share events match these filters.</td></tr> : null}
    </tbody></table>
    <Pagination page={page} totalPages={totalPages} basePath="/admin/share-analytics" extraQuery={extraQuery} />
  </>;
}
