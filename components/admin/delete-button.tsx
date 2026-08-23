"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { TrashIcon } from "@/components/admin/icons";
import { Button } from "@/components/ui/button";

type DeleteButtonProps = {
  endpoint: string;
  confirmLabel: string;
};

export function DeleteButton({ endpoint, confirmLabel }: DeleteButtonProps) {
  const router = useRouter();
  const { showToast } = useToast();
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
      const message = data.error ?? "Failed to delete";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast(`Deleted ${confirmLabel}`);
    router.refresh();
  }

  return (
    <span className="admin-delete">
      <Button type="button" variant="destructive" size="sm" onClick={handleClick} disabled={submitting}>
        <TrashIcon />
        {submitting ? "Deleting…" : "Delete"}
      </Button>
      {error ? <span className="admin-form__error">{error}</span> : null}
    </span>
  );
}
