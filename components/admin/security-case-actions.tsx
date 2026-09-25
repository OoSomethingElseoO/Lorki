"use client";
import { useRouter } from "next/navigation";

export function SecurityCaseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  async function update(next: string) {
    const note = window.prompt("Triage/resolution note:", "");
    if (note === null) return;
    await fetch(`/api/admin/security-cases/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status: next, triageNote: note, resolutionNote: note }) });
    router.refresh();
  }
  return <span><button type="button" onClick={() => update("INVESTIGATING")}>Investigate</button>{" "}{status !== "RESOLVED" ? <button type="button" onClick={() => update("RESOLVED")}>Resolve</button> : null}</span>;
}
