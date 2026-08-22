"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkPaidButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/payouts/${payoutId}/mark-paid`, { method: "POST" });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to mark paid out");
      return;
    }

    router.refresh();
  }

  return (
    <div>
      <button type="button" onClick={handleClick} disabled={submitting}>
        {submitting ? "Marking…" : "Mark paid out"}
      </button>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}
