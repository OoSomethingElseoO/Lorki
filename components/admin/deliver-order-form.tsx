"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeliverOrderFormProps = {
  orderId: string;
};

export function DeliverOrderForm({ orderId }: DeliverOrderFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/orders/${orderId}/deliver`, {
      method: "POST",
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to mark delivered");
      return;
    }

    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={(event) => event.preventDefault()}>
      <button type="button" onClick={handleClick} disabled={submitting}>
        {submitting ? "Marking…" : "Mark delivered"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
