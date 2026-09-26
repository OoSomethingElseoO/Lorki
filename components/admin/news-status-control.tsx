"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { useOwnedMutation } from "@/lib/use-owned-mutation";

const STATUSES = ["DRAFT", "LIVE"] as const;

type NewsStatusControlProps = {
  articleId: string;
  status: (typeof STATUSES)[number];
};

export function NewsStatusControl({ articleId, status }: NewsStatusControlProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(status);
  const mutation = useOwnedMutation();

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // Captured up front, not re-read off `event.target` after the `await`
    // below: this <select>'s value is bound straight to the `status` prop
    // (no local state), so the `setSubmitting(true)` re-render resets the
    // DOM element back to the OLD status before the fetch resolves —
    // reading event.target.value again after that point silently returns
    // the previous status instead of the one just chosen. Same pattern
    // InquiryStatusForm already uses correctly.
    const nextStatus = event.target.value as (typeof STATUSES)[number];
    const previousStatus = currentStatus;
    const result = await mutation.run(
      async (signal) => {
        const response = await fetch(`/api/admin/news/${articleId}`, { method: "PATCH", signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }) });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message ?? data.error ?? "Failed to update status"); }
        return response;
      },
      { optimistic: () => setCurrentStatus(nextStatus), rollback: () => setCurrentStatus(previousStatus) },
    );
    if (result.applied && "error" in result) { showToast(result.error, "error"); return; }
    if (result.applied) { showToast(`Status updated to ${nextStatus}`); router.refresh(); }
  }

  return (
    <select value={currentStatus} onChange={handleChange} disabled={mutation.pending} className="admin-status-select">
      {STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
