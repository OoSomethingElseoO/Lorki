"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { Button } from "@/components/ui/button";

export function RevivePayoutButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    setError(null);

    const response = await fetch(`/api/admin/payouts/${payoutId}/revive`, { method: "POST" });

    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const message = data.error ?? "Failed to revive payout";
      setError(message);
      showToast(message, "error");
      return;
    }

    showToast("Payout released again — find it on /admin/payouts to mark it paid out.");
    router.refresh();
  }

  return (
    <span>
      <Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={submitting}>
        {submitting ? "Reviving…" : "Revive"}
      </Button>
      {error ? <span className="admin-form__error">{error}</span> : null}
    </span>
  );
}
