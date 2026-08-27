"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { menuLinks } from "@/lib/nav-links";

export function HamburgerMenu() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Let visitors dismiss the menu with either a pointer click outside or Escape.
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  return (
    <div className="menu-container" ref={containerRef}>
      <Button
        variant="icon-panel"
        size="icon"
        className="grid! place-items-center gap-[0.28rem]"
        type="button"
        aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls={menuId}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true" className="block h-[0.16rem] w-[1.45rem] bg-current" />
        <span aria-hidden="true" className="block h-[0.16rem] w-[1.45rem] bg-current" />
        <span aria-hidden="true" className="block h-[0.16rem] w-[1.45rem] bg-current" />
      </Button>

      <ul className="dropdown-menu" id={menuId} hidden={!isMenuOpen}>
        {menuLinks.map((link) => (
          <li key={link.href}>
            <Link href={link.href} onClick={() => setIsMenuOpen(false)}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
