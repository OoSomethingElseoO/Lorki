"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;

type CampaignStatusControlProps = {
  campaignId: string;
  status: (typeof STATUSES)[number];
};

export function CampaignStatusControl({ campaignId, status }: CampaignStatusControlProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    setSubmitting(true);
    await fetch(`/api/admin/campaigns/${campaignId}`, {
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
