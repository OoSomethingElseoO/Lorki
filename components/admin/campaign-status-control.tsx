"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusSelectClass } from "@/lib/status-badge";
import { useToast } from "@/components/admin/toast-provider";
import { useOwnedMutation } from "@/lib/use-owned-mutation";

const STATUSES = ["DRAFT", "LIVE", "PAUSED", "ARCHIVED"] as const;

type CampaignStatusControlProps = {
  campaignId: string;
  status: (typeof STATUSES)[number];
};

export function CampaignStatusControl({ campaignId, status }: CampaignStatusControlProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [currentStatus, setCurrentStatus] = useState(status);
  const mutation = useOwnedMutation();

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as (typeof STATUSES)[number];
    const previousStatus = currentStatus;
    const result = await mutation.run(
      async (signal) => {
        const response = await fetch(`/api/admin/campaigns/${campaignId}`, {
          method: "PATCH", signal, headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error?.message ?? data.error ?? "Failed to update status"); }
        return response;
      },
      { optimistic: () => setCurrentStatus(nextStatus), rollback: () => setCurrentStatus(previousStatus) },
    );
    if (result.applied && "error" in result) { showToast(result.error, "error"); return; }
    if (result.applied) { showToast(`Status updated to ${nextStatus}`); router.refresh(); }
  }

  return (
    <select value={currentStatus} onChange={handleChange} disabled={mutation.pending} className={statusSelectClass(currentStatus)}>
      {STATUSES.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
