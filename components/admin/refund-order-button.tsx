"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { RefundIcon } from "@/components/admin/icons";

type RefundOrderButtonProps = {
  orderId: string;
};

export function RefundOrderButton({ orderId }: RefundOrderButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
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
      const message = data.error ?? "Failed to refund order";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Order refunded");
    router.refresh();
  }

  return (
    <div className="admin-form admin-form--inline">
      <button type="button" onClick={handleClick} disabled={submitting}>
        <RefundIcon />
        {submitting ? "Refunding…" : "Refund"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}
