import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

const navLinks = [
  { label: "Overview", href: "/cause/profile" },
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
