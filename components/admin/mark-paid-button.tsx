"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { CheckIcon } from "@/components/admin/icons";

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, { method: "POST" });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? "Failed to mark paid out";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Marked paid out");
    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={submitting}>
        <CheckIcon />
        {submitting ? "Marking…" : "Mark paid out"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}
