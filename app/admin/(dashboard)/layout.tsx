import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

const navLinks = [
  { label: "Conservancies", href: "/admin/conservancies" },
  { label: "Co-ops", href: "/admin/co-ops" },
  { label: "Animals", href: "/admin/animals" },
  { label: "Artists", href: "/admin/artists" },
  { label: "Campaigns", href: "/admin/campaigns" },
  { label: "News", href: "/admin/news" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Inquiries", href: "/admin/inquiries" },
  { label: "Users", href: "/admin/users" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell title="Lorkulup Admin" navLinks={navLinks} variant="admin">
      {children}
    </DashboardShell>
  );
}
