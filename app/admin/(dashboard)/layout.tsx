import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/admin/logout-button";

const navLinks = [
  { label: "Conservancies", href: "/admin/conservancies" },
  { label: "Co-ops", href: "/admin/co-ops" },
  { label: "Animals", href: "/admin/animals" },
  { label: "Artists", href: "/admin/artists" },
  { label: "Campaigns", href: "/admin/campaigns" },
  { label: "News", href: "/admin/news" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminDashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell">
      <nav className="admin-nav" aria-label="Admin navigation">
        <span className="admin-nav__title">Lorkulup Admin</span>
        <ul>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
        <LogoutButton />
      </nav>
      <main className="admin-main">{children}</main>
    </div>
  );
}
