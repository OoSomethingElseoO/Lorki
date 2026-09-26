"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function MfaReminderButton({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    setBusy(true); setError("");
    const response = await fetch(`/api/admin/users/${userId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "SEND_MFA_REMINDER" }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error?.message ?? "Could not send reminder"); return; }
    setSent(true);
  }
  return <span>
    <Button type="button" variant="outline" size="sm" disabled={busy || sent} onClick={send}>{sent ? "Reminder sent" : busy ? "Sending…" : "Remind about MFA"}</Button>
    {error ? <small className="admin-form__error">{error}</small> : null}
  </span>;
}
