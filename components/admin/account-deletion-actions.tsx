"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Action = "APPROVE" | "REJECT" | "RESTORE" | "SUSPEND";

export function AccountDeletionActions({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: Action) {
    const note = window.prompt(`${action} account. Add a review note:`, "");
    if (note === null) return;
    setBusy(true);
    const response = await fetch(`/api/admin/users/${userId}/deletion-request`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    setBusy(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
      window.alert(body?.error?.message ?? "The account action failed.");
      return;
    }
    router.refresh();
  }
  return <span aria-busy={busy || undefined}>
    {status === "PENDING" ? <><button type="button" disabled={busy} onClick={() => act("APPROVE")}>Approve closure</button>{" "}<button type="button" disabled={busy} onClick={() => act("REJECT")}>Reject</button></> : null}
    {status === "APPROVED" ? <button type="button" disabled={busy} onClick={() => act("RESTORE")}>Restore</button> : null}
    {status !== "APPROVED" && status !== "REJECTED" ? <button type="button" disabled={busy} onClick={() => act("SUSPEND")}>Suspend</button> : null}
  </span>;
}
