"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { CheckIcon } from "@/components/admin/icons";
import { Button } from "@/components/ui/button";

type DeliverOrderFormProps = {
  orderId: string;
};

export function DeliverOrderForm({ orderId }: DeliverOrderFormProps) {
  const router = useRouter();
  const { showToast } = useToast();
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
      const message = data.error ?? "Failed to mark delivered";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Order marked delivered");
    router.refresh();
  }

  return (
    <form className="admin-form admin-form--inline" onSubmit={(event) => event.preventDefault()}>
      <Button type="button" variant="form" onClick={handleClick} disabled={submitting}>
        <CheckIcon />
        {submitting ? "Marking…" : "Mark delivered"}
      </Button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </form>
  );
}
