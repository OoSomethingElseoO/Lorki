import { redirect } from "next/navigation";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  robots: { index: false, follow: false, noarchive: true, nosnippet: true },
};

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const navLinks = [
    { label: "My Account", href: "/account" },
    ...(user.isAdmin ? [{ label: "Admin Dashboard", href: "/admin" }] : []),
    user.artist
      ? { label: "Artist Dashboard", href: "/artist" }
      : { label: "Start Selling", href: "/artist/onboarding" },
    ...(user.conservancy ? [{ label: "Cause Dashboard", href: "/cause/profile" }] : []),
  ];

  return (
    <DashboardShell title="My Account" navLinks={navLinks} variant="brand" layout="tabs">
      {children}
    </DashboardShell>
  );
}
