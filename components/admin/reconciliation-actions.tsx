"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReconciliationActions({ id, status, priority, assignedTo }: { id: string; status: string; priority: string; assignedTo: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resolve() {
    const note = window.prompt("Explain how this discrepancy was checked and resolved:");
    if (!note?.trim()) return;
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/reconciliation/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error ?? "Could not resolve case");
      return;
    }
    router.refresh();
  }

  async function triage() {
    const nextPriority = window.prompt("Priority (LOW, NORMAL, HIGH, CRITICAL):", priority) ?? "";
    if (!["LOW", "NORMAL", "HIGH", "CRITICAL"].includes(nextPriority)) return;
    const nextAssignee = window.prompt("Assign to email (optional):", assignedTo ?? "");
    const note = window.prompt("Triage note (optional):") ?? "";
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/admin/reconciliation/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ priority: nextPriority, assignedTo: nextAssignee?.trim() || undefined, note }) });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Could not triage case"); return; }
    router.refresh();
  }

  return status === "RESOLVED" ? <span>Resolved</span> : <span>
    <button type="button" disabled={busy} onClick={triage}>Triage</button>{" "}
    <button type="button" disabled={busy} onClick={resolve}>Resolve</button>
    {error ? <small className="admin-form__error">{error}</small> : null}
  </span>;
}
