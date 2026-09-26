import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { checkPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { AccountDeletionActions } from "@/components/admin/account-deletion-actions";

export const dynamic = "force-dynamic";

export default async function AccountDeletionsPage() {
  const reviewer = await getCurrentUser();
  if (!checkPermission(reviewer, "OPS_ADMIN").authorized) redirect("/login?next=/admin/account-deletions");
  const requests = await prisma.accountDeletionRequest.findMany({
    where: { status: { in: ["PENDING", "APPROVED"] } },
    include: { user: { select: { id: true, email: true, name: true, accountStatus: true, deletionRequestedAt: true, legalHoldUntil: true } } },
    orderBy: { requestedAt: "asc" },
    take: 200,
  });
  return <>
    <h1>Account closure requests</h1>
    <p className="admin-form__hint">Review requests here. Approval disables login and starts the retention workflow; it does not erase orders, payment, payout, reconciliation, security, or audit records.</p>
    <table className="admin-table">
      <thead><tr><th>Requested</th><th>User</th><th>Reason</th><th>Account state</th><th>Legal hold</th><th>Request</th><th>Actions</th></tr></thead>
      <tbody>
        {requests.map((item) => <tr key={item.id}>
          <td>{item.requestedAt.toLocaleString()}</td>
          <td>{item.user.name || "—"}<br /><small>{item.user.email}</small></td>
          <td>{item.reason || "—"}</td>
          <td>{item.user.accountStatus}</td>
          <td>{item.user.legalHoldUntil && item.user.legalHoldUntil > new Date() ? item.user.legalHoldUntil.toLocaleDateString() : "No active hold"}</td>
          <td>{item.status}</td>
          <td><AccountDeletionActions userId={item.userId} status={item.status} /></td>
        </tr>)}
        {requests.length === 0 ? <tr><td colSpan={7}>No pending account closure requests.</td></tr> : null}
      </tbody>
    </table>
  </>;
}
