import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

const navLinks = [
  { label: "Dashboard", href: "/cause/profile" },
  { label: "My Account", href: "/account" },
];

export default async function CauseDashboardLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.conservancy) {
    redirect("/login");
  }

  return (
    <DashboardShell title="Cause Dashboard" navLinks={navLinks} variant="brand">
      {children}
    </DashboardShell>
  );
}
