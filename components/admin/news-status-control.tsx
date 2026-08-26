"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";

const STATUSES = ["DRAFT", "LIVE"] as const;

type NewsStatusControlProps = {
  articleId: string;
  status: (typeof STATUSES)[number];
};

export function NewsStatusControl({ articleId, status }: NewsStatusControlProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    // Captured up front, not re-read off `event.target` after the `await`
    // below: this <select>'s value is bound straight to the `status` prop
    // (no local state), so the `setSubmitting(true)` re-render resets the
    // DOM element back to the OLD status before the fetch resolves —
    // reading event.target.value again after that point silently returns
    // the previous status instead of the one just chosen. Same pattern
    // InquiryStatusForm already uses correctly.
    const nextStatus = event.target.value;
    setSubmitting(true);
    const response = await fetch(`/api/admin/news/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showToast(data.error ?? "Failed to update status", "error");
      return;
    }

    showToast(`Status updated to ${nextStatus}`);
    router.refresh();
  }

  return (
    <select value={status} onChange={handleChange} disabled={submitting} className="admin-status-select">
      {STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
