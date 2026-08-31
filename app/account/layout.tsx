import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

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
    user.conservancy
      ? { label: "Cause Dashboard", href: "/cause/profile" }
      : { label: "Register a Cause", href: "/cause/onboarding" },
  ];

  return (
    <DashboardShell title="My Account" navLinks={navLinks} variant="brand">
      {children}
    </DashboardShell>
  );
}
