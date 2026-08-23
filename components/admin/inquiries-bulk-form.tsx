"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/admin/toast-provider";

export function InquiriesBulkForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [bulkStatus, setBulkStatus] = useState<"NEW" | "CONTACTED" | "CLOSED">("CONTACTED");
  const [submitting, setSubmitting] = useState(false);

  function getCheckboxes(): HTMLInputElement[] {
    if (!formRef.current) return [];
    return Array.from(formRef.current.querySelectorAll<HTMLInputElement>('input[name="inquiryIds"]'));
  }

  function handleChange() {
    setSelectedCount(getCheckboxes().filter((checkbox) => checkbox.checked).length);
  }

  function handleSelectAll(event: React.ChangeEvent<HTMLInputElement>) {
    const checked = event.target.checked;
    const checkboxes = getCheckboxes();
    checkboxes.forEach((checkbox) => {
      checkbox.checked = checked;
    });
    setSelectedCount(checked ? checkboxes.length : 0);
  }

  async function handleBulkApply() {
    const ids = getCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    if (ids.length === 0) return;

    setSubmitting(true);
    const response = await fetch("/api/admin/inquiries/bulk-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inquiryIds: ids, status: bulkStatus }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showToast(data.error ?? "Failed to update inquiries", "error");
      return;
    }

    const data = await response.json();
    showToast(`Updated ${data.count} inquir${data.count === 1 ? "y" : "ies"} to ${bulkStatus}`);
    setSelectedCount(0);
    router.refresh();
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(event) => event.preventDefault()}>
      <div className="admin-bulk-bar">
        <label className="admin-bulk-bar__select-all">
          <input type="checkbox" onChange={handleSelectAll} aria-label="Select all inquiries" />
          Select all
        </label>
        <span className="admin-bulk-bar__count">{selectedCount} selected</span>
        <select
          value={bulkStatus}
          onChange={(event) => setBulkStatus(event.target.value as typeof bulkStatus)}
          aria-label="Bulk status to apply"
        >
          <option value="NEW">New</option>
          <option value="CONTACTED">Contacted</option>
          <option value="CLOSED">Closed</option>
        </select>
        <button type="button" onClick={handleBulkApply} disabled={selectedCount === 0 || submitting}>
          {submitting ? "Updating…" : "Apply to selected"}
        </button>
      </div>
      {children}
    </form>
  );
}
