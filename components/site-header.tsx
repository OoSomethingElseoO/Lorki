import Link from "next/link";
import { HamburgerMenu } from "@/components/hamburger-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";
import { getBranding } from "@/lib/settings";

const iconSvgClass =
  "h-[1.45rem] w-[1.45rem] fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] stroke-2";

export async function SiteHeader() {
  const { siteName } = await getBranding();

  return (
    <header className="site-header">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <nav className="site-nav" aria-label="Primary navigation">
        <HamburgerMenu />

        <Link className="site-wordmark" href="/" aria-label={`${siteName} home`}>
          {siteName}
        </Link>

        <div className="site-actions" aria-label="Site tools">
          <ThemeToggle className={buttonVariants({ variant: "icon-panel", size: "icon" })} />
          <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/search" aria-label="Search artwork">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className={iconSvgClass}>
              <path d="m21 21-4.3-4.3m1.3-5.2a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" />
            </svg>
          </Link>
          <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/account" aria-label="Open account">
            <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false" className={iconSvgClass}>
              <path d="M20 21a8 8 0 0 0-16 0m12-13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
            </svg>
          </Link>
        </div>
      </nav>
    </header>
  );
}
