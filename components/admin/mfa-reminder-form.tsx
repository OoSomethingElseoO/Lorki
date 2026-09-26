"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function MfaReminderForm() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/admin/mfa-reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setMessage(data.error?.message ?? "Could not send reminder"); return; }
    setMessage("Reminder sent."); setEmail("");
  }
  return <form className="admin-form admin-form--embedded" onSubmit={submit}>
    <label htmlFor="mfa-reminder-email">User email</label>
    <input id="mfa-reminder-email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="collector@example.com" />
    <Button type="submit" variant="form" disabled={busy}>{busy ? "Sending…" : "Send MFA reminder"}</Button>
    {message ? <p className="admin-form__hint" role="status">{message}</p> : null}
  </form>;
}
