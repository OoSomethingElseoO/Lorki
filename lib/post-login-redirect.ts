type PostLoginRedirectInput = {
  // Where the visitor was trying to go before being sent to /login (e.g.
  // a protected page's proxy.ts redirect) — always honored first, since
  // it's the one signal that reflects what the person actually clicked.
  next: string | null;
  isAdmin: boolean;
  hasArtist: boolean;
  hasConservancy: boolean;
};

// Every login used to land on /account regardless of role — an admin
// signing in saw a warm-sand "Are you an artist?" consumer page before
// ever reaching the actual admin tool, and an artist- or cause-only user
// always needed one extra click past a generic hub to reach their own
// dashboard. A user can genuinely hold both the artist and conservancy
// role at once (see the schema comment on User), so "always redirect to
// the one dashboard" doesn't work in general — this only skips /account
// when there's exactly one unambiguous place to send someone; a dual-role
// or no-role user still lands on /account, which is where the choice (or
// the onboarding upsell) actually belongs.
export function resolvePostLoginRedirect({ next, isAdmin, hasArtist, hasConservancy }: PostLoginRedirectInput): string {
  if (next) {
    return next;
  }
  if (isAdmin) {
    return "/admin";
  }
  if (hasArtist && !hasConservancy) {
    return "/seller";
  }
  if (hasConservancy && !hasArtist) {
    return "/cause/profile";
  }
  return "/account";
}
