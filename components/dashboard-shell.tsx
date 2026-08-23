import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ToastProvider } from "@/components/admin/toast-provider";

type NavLink = { label: string; href: string };

type DashboardShellProps = {
  title: string;
  navLinks: NavLink[];
  /** "admin" = internal-tool look (neutral gray, system font).
   *  "brand" = customer-facing look (warm sand background, display serif).
   *  Only this modifier differs between areas — the shell/nav markup and
   *  CSS are the same component and the same rules everywhere. */
  variant: "admin" | "brand";
  children: ReactNode;
};

export function DashboardShell({ title, navLinks, variant, children }: DashboardShellProps) {
  return (
    // Every area (admin/account/seller/cause) uses this shell, and several
    // shared action components (e.g. DeleteButton) call useToast() —
    // wrapping it here once means no area's layout can forget to provide
    // it and crash on render.
    <ToastProvider>
      <div className="dashboard-shell">
        <nav className="dashboard-nav" aria-label={`${title} navigation`}>
          <span className="dashboard-nav__title">{title}</span>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
          <ThemeToggle className={cn(buttonVariants({ variant: "sidebar", size: "icon" }), "mt-auto")} />
          <LogoutButton className={buttonVariants({ variant: "sidebar", size: "sm" })} />
        </nav>
        <main className={`dashboard-main dashboard-main--${variant}`} id="main-content">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
