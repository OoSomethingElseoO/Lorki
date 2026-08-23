// One shared vocabulary for every status shown across the admin/seller/
// cause dashboards (CampaignStatus, OrderStatus, PayoutStatus,
// InquiryStatus) — keeps color meaning consistent (green always means
// "done/live", amber always means "awaiting action") instead of each page
// inventing its own scheme. See the .status-badge / .admin-status-select
// rules in app/globals.css.
export type StatusTone = "positive" | "pending" | "negative" | "neutral";

const TONE_BY_STATUS: Record<string, StatusTone> = {
  // CampaignStatus
  LIVE: "positive",
  DRAFT: "pending",
  PAUSED: "neutral",
  ARCHIVED: "negative",
  // OrderStatus
  PENDING: "pending",
  PAID: "pending",
  SHIPPED: "neutral",
  DELIVERED: "positive",
  REFUNDED: "negative",
  // PayoutStatus
  RELEASED: "positive",
  FAILED: "negative",
  // InquiryStatus
  NEW: "pending",
  CONTACTED: "neutral",
  CLOSED: "positive",
};

export function statusTone(status: string): StatusTone {
  return TONE_BY_STATUS[status] ?? "neutral";
}

export function statusBadgeClass(status: string): string {
  return `status-badge status-badge--${statusTone(status)}`;
}

export function statusSelectClass(status: string): string {
  return `admin-status-select admin-status-select--${statusTone(status)}`;
}
