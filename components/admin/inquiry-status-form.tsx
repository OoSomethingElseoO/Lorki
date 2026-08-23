"use client";

import { useRouter } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import { statusSelectClass } from "@/lib/status-badge";

type InquiryStatusFormProps = {
  inquiryId: string;
  status: "NEW" | "CONTACTED" | "CLOSED";
};

export function InquiryStatusForm({ inquiryId, status }: InquiryStatusFormProps) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextStatus = event.target.value as InquiryStatusFormProps["status"];
    setSaving(true);
    setError(null);

    const response = await fetch(`/api/admin/inquiries/${inquiryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: nextStatus }),
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Failed to update status");
      return;
    }

    setCurrent(nextStatus);
    router.refresh();
  }

  return (
    <div>
      <select value={current} onChange={handleChange} disabled={saving} aria-label="Inquiry status" className={statusSelectClass(current)}>
        <option value="NEW">New</option>
        <option value="CONTACTED">Contacted</option>
        <option value="CLOSED">Closed</option>
      </select>
      {error ? <p className="admin-form__error">{error}</p> : null}
    </div>
  );
}
