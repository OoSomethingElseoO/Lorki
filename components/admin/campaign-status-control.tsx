"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusSelectClass } from "@/lib/status-badge";
import { useToast } from "@/components/admin/toast-provider";

const STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;

type CampaignStatusControlProps = {
  campaignId: string;
  status: (typeof STATUSES)[number];
};

export function CampaignStatusControl({ campaignId, status }: CampaignStatusControlProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSubmitting(true);
    const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
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
    <select value={status} onChange={handleChange} disabled={submitting} className={statusSelectClass(status)}>
      {STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
