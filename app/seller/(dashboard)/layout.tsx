import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

const navLinks = [
  { label: "Dashboard", href: "/seller" },
  { label: "Edit Profile", href: "/seller/profile" },
  { label: "My Listings", href: "/seller/artworks" },
  { label: "My Account", href: "/account" },
];

export default async function SellerDashboardLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.artist) {
    redirect("/login");
  }

  return (
    <DashboardShell title="Seller Dashboard" navLinks={navLinks} variant="brand">
      {children}
    </DashboardShell>
  );
}
