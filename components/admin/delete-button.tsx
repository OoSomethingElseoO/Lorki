"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteButtonProps = {
  endpoint: string;
  confirmLabel: string;
};

export function DeleteButton({ endpoint, confirmLabel }: DeleteButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    if (!window.confirm(`Delete ${confirmLabel}? This can't be undone.`)) {
      return;
    }

    setSubmitting(true);
    setError(null);

    const response = await fetch(endpoint, { method: "DELETE" });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to delete");
      return;
    }

    router.refresh();
  }

  return (
    <span className="admin-delete">
      <button type="button" className="admin-delete__button" onClick={handleClick} disabled={submitting}>
        {submitting ? "Deleting…" : "Delete"}
      </button>
      {error ? <span className="admin-form__error">{error}</span> : null}
    </span>
  );
}
