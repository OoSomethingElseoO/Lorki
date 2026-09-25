"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OfferActions({ offerId, status }: { offerId: string; status: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function act(path: string) {
    setBusy(true); setError(null);
    const response = await fetch(path, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(body.error ?? "Action failed"); return; }
    if (body.url) window.location.assign(body.url); else router.refresh();
  }
  return <div>
    {status === "SUBMITTED" ? <button type="button" disabled={busy} onClick={() => act(`/api/admin/offers/${offerId}/accept`)}>Accept winner</button> : null}
    {status === "WINNING" ? <button type="button" disabled={busy} onClick={() => act(`/api/admin/offers/${offerId}/checkout`)}>Create payment link</button> : null}
    {error ? <p className="admin-form__error">{error}</p> : null}
  </div>;
}
