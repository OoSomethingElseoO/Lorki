"use client";

import { useState } from "react";
import { useToast } from "@/components/admin/toast-provider";
import { Button } from "@/components/ui/button";

export function InquiryCheckoutButton({ inquiryId }: { inquiryId: string }) {
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function startCheckout() {
    setLoading(true);
    const response = await fetch(`/api/admin/inquiries/${inquiryId}/checkout`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok || !data.url) {
      showToast(data.error ?? "Could not create payment link", "error");
      return;
    }
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  return <Button type="button" variant="form" onClick={startCheckout} disabled={loading}>{loading ? "Creating…" : "Create payment link"}</Button>;
}
