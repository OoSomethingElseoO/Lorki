// Shared between HamburgerMenu (a "use client" component) and Footer (a
// server component). Plain data exports from a "use client" module don't
// reliably cross the RSC client boundary — importing menuLinks straight
// from hamburger-menu.tsx into Footer resolved to an opaque client
// reference at runtime instead of the real array (TypeScript saw the
// correct type either way, so this only surfaced as a runtime error).
// Living in its own directive-free module sidesteps that entirely.
export const menuLinks = [
  { label: "Mission Statement", href: "/mission-statement" },
  { label: "Artists", href: "/artists" },
  { label: "Originals", href: "/originals" },
  { label: "Prints", href: "/prints" },
  { label: "News", href: "/news" },
  { label: "Sell Your Art", href: "/artist" },
  { label: "Contact Us", href: "/contact-us" },
];
