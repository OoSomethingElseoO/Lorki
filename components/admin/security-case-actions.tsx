"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOwnedMutation } from "@/lib/use-owned-mutation";

export function SecurityCaseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [currentStatus, setCurrentStatus] = useState(status);
  const { pending, run } = useOwnedMutation();
  async function update(next: string) {
    const note = window.prompt("Triage/resolution note:", "");
    if (note === null) return;
    const previous = currentStatus;
    const result = await run(
      async (signal) => {
        const response = await fetch(`/api/admin/security-cases/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: next, triageNote: note, resolutionNote: note }),
          signal,
        });
        if (!response.ok) throw new Error("Failed to update security case");
        return response;
      },
      { optimistic: () => setCurrentStatus(next), rollback: () => setCurrentStatus(previous) },
    );
    if (result.applied && !("error" in result)) router.refresh();
  }
  return <span aria-busy={pending || undefined}><button type="button" disabled={pending} onClick={() => update("INVESTIGATING")}>Investigate</button>{" "}{currentStatus !== "RESOLVED" ? <button type="button" disabled={pending} onClick={() => update("RESOLVED")}>Resolve</button> : null}</span>;
}
