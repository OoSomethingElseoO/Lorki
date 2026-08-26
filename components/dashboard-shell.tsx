"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
  /** "sidebar" (default) = persistent left nav, fine for a handful of
   *  links (account/seller/cause). "tabs" = a horizontal tab strip above
   *  the content instead — admin has 11 sections, too many for a sidebar
   *  to stay scannable. */
  layout?: "sidebar" | "tabs";
  children: ReactNode;
};

export function DashboardShell({ title, navLinks, variant, layout = "sidebar", children }: DashboardShellProps) {
  const pathname = usePathname();
  const isTabs = layout === "tabs";

  function isLinkActive(href: string) {
    // Exact match for the shell's own root link (so e.g. "My Account" only
    // lights up on /account, not on some other page nested under a similar
    // prefix); prefix match for everything else so a sub-page like
    // /admin/orders still highlights the "Orders" link that led there.
    return href === "/account" || href === "/seller" || href === "/cause/profile"
      ? pathname === href
      : pathname === href || pathname.startsWith(`${href}/`);
  }

  const links = navLinks.map((link) => {
    const isActive = isLinkActive(link.href);
    return (
      <li key={link.href}>
        <Link href={link.href} aria-current={isActive ? "page" : undefined} className={isActive ? "dashboard-nav__link--active" : undefined}>
          {link.label}
        </Link>
      </li>
    );
  });

  return (
    // Every area (admin/account/seller/cause) uses this shell, and several
    // shared action components (e.g. DeleteButton) call useToast() —
    // wrapping it here once means no area's layout can forget to provide
    // it and crash on render.
    <ToastProvider>
      <div className={cn("dashboard-shell", isTabs && "dashboard-shell--tabs")}>
        <nav className={cn("dashboard-nav", isTabs && "dashboard-nav--tabs")} aria-label={`${title} navigation`}>
          {isTabs ? (
            <>
              <div className="dashboard-nav__top-row">
                <span className="dashboard-nav__title">{title}</span>
                <div className="dashboard-nav__actions">
                  <ThemeToggle className={buttonVariants({ variant: "sidebar", size: "icon" })} />
                  <LogoutButton className={buttonVariants({ variant: "sidebar", size: "sm" })} />
                </div>
              </div>
              <ul className="dashboard-nav__tabs">{links}</ul>
            </>
          ) : (
            <>
              <span className="dashboard-nav__title">{title}</span>
              <ul>{links}</ul>
              <ThemeToggle className={cn(buttonVariants({ variant: "sidebar", size: "icon" }), "mt-auto")} />
              <LogoutButton className={buttonVariants({ variant: "sidebar", size: "sm" })} />
            </>
          )}
        </nav>
        <main className={`dashboard-main dashboard-main--${variant}`} id="main-content">
          {children}
        </main>
      </div>
    </ToastProvider>
  );
}
