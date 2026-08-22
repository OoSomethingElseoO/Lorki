"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

const menuLinks = [
  { label: "Mission Statement", href: "/mission-statement" },
  { label: "Artists", href: "/artists" },
  { label: "Originals", href: "/originals" },
  { label: "Prints", href: "/prints" },
  { label: "News", href: "/news" },
  { label: "Sell Your Art", href: "/seller" },
  { label: "Contact Us", href: "/contact-us" },
];

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
      <button
        className="icon-button hamburger-button"
        type="button"
        aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-controls={menuId}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

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
