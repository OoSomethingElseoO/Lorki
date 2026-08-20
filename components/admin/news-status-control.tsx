"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = ["DRAFT", "LIVE"] as const;

type NewsStatusControlProps = {
  articleId: string;
  status: (typeof STATUSES)[number];
};

export function NewsStatusControl({ articleId, status }: NewsStatusControlProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSubmitting(true);
    await fetch(`/api/admin/news/${articleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: event.target.value }),
    });
    setSubmitting(false);
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
