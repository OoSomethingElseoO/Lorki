"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountDeletionRequest() {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!window.confirm("Request account closure? You will be signed out immediately while an administrator reviews it.")) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const response = await fetch("/api/account/deletion-request", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    const body = await response.json().catch(() => null) as { message?: string; error?: { message?: string } } | null;
    setPending(false);
    if (!response.ok) {
      setError(body?.error?.message ?? body?.message ?? "Unable to submit the request.");
      return;
    }
    setMessage("Your request was submitted. Signing you out…");
    window.setTimeout(() => router.replace("/login?account=deletion-requested"), 450);
  }

  return (
    <div className="account-danger-zone">
      <h2>Close account</h2>
      <p className="admin-form__hint">This signs you out and suspends access while an administrator reviews the request. Orders, payments, and legally required records are retained.</p>
      <label htmlFor="account-deletion-reason">Reason (optional)</label>
      <textarea id="account-deletion-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} rows={3} />
      {error ? <p className="admin-form__error" role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
      <button type="button" className="button button--danger" disabled={pending} onClick={submit}>{pending ? "Submitting…" : "Request account closure"}</button>
    </div>
  );
}
