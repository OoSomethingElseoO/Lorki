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
    setSubmitting(true);
    const response = await fetch(`/api/admin/news/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.target.value }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showToast(data.error ?? "Failed to update status", "error");
      return;
    }

    showToast(`Status updated to ${event.target.value}`);
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
