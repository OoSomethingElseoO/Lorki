type PostLoginRedirectInput = {
  // Where the visitor was trying to go before being sent to /login (e.g.
  // a protected page's proxy.ts redirect) — always honored first, since
  // it's the one signal that reflects what the person actually clicked.
  next: string | null;
  isAdmin: boolean;
  hasArtist: boolean;
  hasConservancy: boolean;
};

// Admins and users with one clear operating dashboard retain those
// destinations. Normal customers—including legacy dual-capability accounts—
// land on the catalogue first; account/order controls remain in the header.
export function resolvePostLoginRedirect({ next, isAdmin, hasArtist, hasConservancy }: PostLoginRedirectInput): string {
  if (next) {
    return next;
  }
  if (isAdmin) {
    return "/admin";
  }
  if (hasArtist && !hasConservancy) {
    return "/artist";
  }
  if (hasConservancy && !hasArtist) {
    return "/cause/profile";
  }
  // A normal customer should land on the catalogue, not an account/settings
  // screen. Account actions remain available from the header.
  return "/products";
}
