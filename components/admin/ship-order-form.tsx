"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type ShipOrderFormProps = {
  orderId: string;
};

export function ShipOrderForm({ orderId }: ShipOrderFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/orders/${orderId}/ship`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        carrier: form.get("carrier"),
        trackingNumber: form.get("trackingNumber") || undefined,
        method: form.get("method"),
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to mark shipped");
      return;
    }

    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={handleSubmit}>
      <input name="carrier" placeholder="Carrier" required />
      <input name="trackingNumber" placeholder="Tracking # (optional)" />
      <select name="method" defaultValue="ORIGINAL_FOUNDER">
        <option value="ORIGINAL_FOUNDER">Original — founder-shipped</option>
        <option value="ORIGINAL_FREIGHT">Original — freight-forwarded</option>
        <option value="PRINT_POD">Print — on-demand</option>
      </select>
      <button type="submit" disabled={submitting}>
        {submitting ? "Marking…" : "Mark shipped"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
