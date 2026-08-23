"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/admin/toast-provider";

// A native, uncontrolled <form> wrapping server-rendered rows: each row's
// own checkbox (`name="payoutIds"`) needs no client-side code of its own —
// the change event just bubbles up to this form's onChange, so the server
// component that renders the table rows doesn't need to become a client
// component itself.
export function PayoutsBulkForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { showToast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedCount, setSelectedCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function getCheckboxes(): HTMLInputElement[] {
    if (!formRef.current) return [];
    return Array.from(formRef.current.querySelectorAll<HTMLInputElement>('input[name="payoutIds"]'));
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

  async function handleBulkMarkPaid() {
    const ids = getCheckboxes()
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);
    if (ids.length === 0) return;

    setSubmitting(true);
    const response = await fetch("/api/admin/payouts/bulk-mark-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payoutIds: ids }),
    });
    setSubmitting(false);

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      showToast(data.error ?? "Failed to mark payouts paid out", "error");
      return;
    }

    const data = await response.json();
    showToast(`Marked ${data.count} payout${data.count === 1 ? "" : "s"} paid out`);
    setSelectedCount(0);
    router.refresh();
  }

  return (
    <form ref={formRef} onChange={handleChange} onSubmit={(event) => event.preventDefault()}>
      <div className="admin-bulk-bar">
        <label className="admin-bulk-bar__select-all">
          <input type="checkbox" onChange={handleSelectAll} aria-label="Select all eligible payouts" />
          Select all
        </label>
        <span className="admin-bulk-bar__count">{selectedCount} selected</span>
        <button type="button" onClick={handleBulkMarkPaid} disabled={selectedCount === 0 || submitting}>
          {submitting ? "Marking…" : "Mark selected paid out"}
        </button>
      </div>
      {children}
    </form>
  );
}
