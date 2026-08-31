import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { getCurrentUser } from "@/lib/auth";

const navLinks = [
  { label: "Overview", href: "/artist" },
  { label: "Edit Profile", href: "/artist/profile" },
  { label: "My Listings", href: "/artist/artworks" },
  { label: "My Account", href: "/account" },
];

export default async function ArtistDashboardLayout({ children }: { children: ReactNode }) {
  const currentUser = await getCurrentUser();
  if (!currentUser?.artist) {
    redirect("/login");
  }

  return (
    <DashboardShell title="Artist Dashboard" navLinks={navLinks} variant="brand">
      {children}
    </DashboardShell>
  );
}
