"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type RefundOrderButtonProps = {
  orderId: string;
};

export function RefundOrderButton({ orderId }: RefundOrderButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/orders/${orderId}/refund`, {
      method: "POST",
    });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to refund order");
      return;
    }

    router.refresh();
  }

  return (
    <div className="admin-form admin-form--inline">
      <button type="button" onClick={handleClick} disabled={submitting}>
        {submitting ? "Refunding…" : "Refund"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}
