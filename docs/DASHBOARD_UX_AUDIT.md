# Dashboard UX audit

Findings from an independent audit of the logged-in areas (admin, seller,
cause, account) — the public storefront was not in scope, it's already had
dedicated design work (hero, rotunda carousel, artist fan carousel, print
rack). Confirmed by direct code read + live Playwright screenshots against
a local build, not just visual impression.

## Root cause

There is no generic card/panel component in this codebase, and no shared
page-section/section-header component. Every "boxed content" need — actual
input forms, CTA cards, settings panels, campaign summaries — reaches for
`.admin-form` (styled for input-field readability, `max-width: 36rem`) or
`.admin-campaign-card__controls` (styled for one specific admin card),
regardless of fit, then patches the mismatch with inline styles. Dashboard
pages are bare React fragments with sections dumped directly inside — no
page-level layout container at all. This is why the gap vs. the storefront
reads as structural, not just "less pretty": the storefront is built from
purpose-built components, dashboard pages are not built from components at
all.

`app/admin`'s own top-level pages (the CRUD tables, create forms,
pagination) are the exception — consistent, no inline styles, genuinely
fine. The problem is specifically: Settings, Seller profile, Cause profile,
the seller dashboard, and `app/account`.

## Findings

- [x] **No shared card/panel or section-header component exists.**
  Everything boxed borrows `.admin-form` or `.admin-campaign-card__controls`
  regardless of whether the content is actually a form.
  **Now exists:** `components/ui/card.tsx` — `Card`/`CardHeader`/
  `CardTitle`/`CardDescription`/`CardContent`. `variant="admin"` (default,
  mirrors `.admin-form`'s own box) or `variant="brand"` (mirrors the
  storefront's `.artist-card`/`.artwork-card` family — use inside a
  `dashboard-main--brand` area: seller/cause/account); `padding="default"
  | "lg" | "none"`. No baked-in `max-width` — size it from the outside.
  CSS lives in `app/globals.css` as `.ui-card`/`.ui-card--admin`/
  `.ui-card--brand`/`.ui-card__*`. Paired with a new tabs primitive,
  `components/ui/tabs.tsx` (`Tabs`/`TabsList`/`TabsTrigger`/`TabsContent`)
  — real `role="tablist"/"tab"/"tabpanel"`, `aria-selected`, roving
  tabindex, Left/Right/Home/End keyboard nav, no external dependency.
  `TabsContent` keeps inactive panels mounted (`hidden` attribute, not
  unmounted) so fields inside a multi-tab `<form>` stay part of one
  submission — see the settings-form usage below for why that mattered in
  practice. CSS as `.ui-tabs-list`/`.ui-tabs-trigger`/`.ui-tabs-content`,
  flat/sharp-cornered to match `components/ui/button.tsx`'s style, using
  `currentColor`/`inherit` so it follows either token set automatically.
- [x] **Admin Settings is 4 unrelated concerns in one scroll.**
  `components/admin/settings-form.tsx` — Branding / Stripe / Flutterwave /
  Email in one `<form>`, separated only by `<h2>`. 2439px tall at 1440px
  wide. Should be tabs.
  **Done:** converted to the new `Tabs`/`Card` primitives above — one tab
  per concern, each tab's fields in their own `Card`. Still a single
  `<form>`/single Save button underneath (unchanged behavior — one submit
  saves whatever changed on any tab), which is exactly why
  `TabsContent` had to keep hidden panels mounted rather than unmount them.
  That surfaced a real bug worth flagging for future Tabs+form usage: the
  Hero image field (`ImageUploadField`, Branding tab) is `required`, and a
  browser's native constraint validation does NOT exempt a field just
  because its tab is currently `hidden` — it still blocks the whole form's
  submission and tries (and fails) to focus the hidden field, so clicking
  Save while on a different tab did nothing, silently. Fixed here with
  `noValidate` on the `<form>` (the server already treats a blank Hero
  image as valid). Any future form split across tabs with a `required`
  field should either add `noValidate` too or drop `required` in favor of
  its own JS-side validation.
- [ ] **Seller "Edit Profile" and Cause "Your Cause" merge identity fields
  and payout fields under one shared Save button.**
  `components/seller-settings-panel.tsx` / `components/cause-settings-panel.tsx`
  — two separate `<form>`-based child components (`SellerProfileForm`/
  `PayoutSettingsForm`) glued together by imperative `ref.current.submit()`
  calls from one external button, not a natural single form or two
  independently-submittable ones. Editing your bio can resubmit your bank
  details. Should be split (tabs, or at minimum independently-savable
  cards).
- [x] **Three unreconciled width caps against their containers.**
  `.impact-totals` (`app/globals.css:1097`) and `.account-orders`
  (`app/globals.css:1353`) both cap at `max-width: 60rem`; `.admin-form`
  (`app/globals.css:1761`) caps at `36rem` — all centered inside a much
  wider ~68–84rem page column, while sibling elements (campaign cards) run
  full width. On a 1440px screen this leaves ~128px dead gutters on the
  stat row and up to ~900px of empty background beside a settings form.
  **Done:** `.dashboard-main--brand` (seller/cause/account) now caps at
  `60rem`, mirroring the identical fix `.dashboard-main--admin` already had
  for the same reason. Also fixes `.campaign-card`, which had no cap at all
  and was stretching to the full ~84rem width with overly long
  single-column text lines — not previously flagged as its own item, found
  while fixing this one. Verified live: account page cards/order-history
  box now share one consistent column width, no dead gutters.
- [ ] **Seller dashboard "Your listings" section renders nothing.**
  `app/seller/(dashboard)/page.tsx:124-131` — heading + "Manage all
  listings" button only, no actual content. Ships as dead space in both
  empty and populated states.
- [x] **Admin Campaigns page overflows horizontally on mobile.**
  `.admin-campaign-card header` / `.admin-campaign-card__controls`
  (`app/globals.css:2299-2311`) — no `flex-wrap`, no `min-width: 0`, unlike
  every comparable flex container elsewhere in the file that got this fix
  in the `@media (max-width: 720px)` block. Measured live: 487px content
  in a 390px viewport, controls clipped off-screen.
  **Done:** added `flex-wrap: wrap` + `min-width: 0` to both selectors.
  Verified live: `document.documentElement.scrollWidth` now exactly equals
  `window.innerWidth` (390 = 390) at 390px viewport, was 487 vs 390 before.
- [ ] **The same inline-style flex-row string is copy-pasted verbatim 3
  times**, instead of a shared class: `app/seller/(dashboard)/page.tsx`
  (×2, lines 69 & 125) and `app/seller/(dashboard)/artworks/page.tsx:26`.
- [x] **`app/account/page.tsx` reuses `.admin-form` for a plain CTA card
  with zero form fields**, then inline-overrides its own `max-width: 36rem`
  back to `none` to cancel it out (lines 56, 68) — the code comment above
  it (lines 42-53) documents this as a known workaround.
  **Done:** replaced with `<Card variant="brand">` from the new primitive —
  no `max-width: none` override needed since `Card` never bakes one in.
  Trimmed the now-stale part of the comment that described the workaround
  it used to need.
- [x] **`components/admin/settings-form.tsx:98`** has
  `style={{ maxWidth: "36rem" }}` inline, redundantly duplicating the value
  its own `.admin-form` class already sets. Dead/leftover code.
  **Done:** removed as part of the Card/Tabs conversion above — the form no
  longer uses `.admin-form`'s own box (max-width included) at all, it uses
  `Card` instead, so there was nothing left to fight with an inline style.

## Fix order

1. Build the missing shared primitives — a generic card/panel component and
   a tabs component — that the rest of this list depends on.
2. Admin Settings, Seller profile, Cause profile → convert to tabs using
   the new primitives; split identity vs. payout into independently-savable
   sections while doing so.
3. Reconcile the three width caps against their actual containers.
4. Fill or remove the empty "Your listings" section; fix the admin
   Campaigns mobile overflow; remove the redundant inline `maxWidth` in
   `settings-form.tsx`; replace the 3 copy-pasted inline-style instances
   with the new shared component.
