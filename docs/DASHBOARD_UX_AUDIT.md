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
- [x] **Seller "Edit Profile" and Cause "Your Cause" merge identity fields
  and payout fields under one shared Save button.**
  `components/seller-settings-panel.tsx` / `components/cause-settings-panel.tsx`
  — two separate `<form>`-based child components (`SellerProfileForm`/
  `PayoutSettingsForm`) glued together by imperative `ref.current.submit()`
  calls from one external button, not a natural single form or two
  independently-submittable ones. Editing your bio can resubmit your bank
  details. Should be split (tabs, or at minimum independently-savable
  cards).
  **Cause half done:** `components/cause-settings-panel.tsx` now uses
  `Tabs`/`Card` (variant="brand") — a "Profile" tab (`CauseProfileForm`) and
  a "Payouts" tab (`PayoutSettingsForm`), each with its own Save button
  calling only that form's own `ref.current.submit()`. Neither child form's
  API changed — each already rendered its own `<form>`/box and exposed
  `SaveFormHandle`, so this was a composition-only change (two buttons
  instead of one shared one). Verified live via Playwright against a real
  signup + cause onboarding flow: editing only the Profile tab and saving
  leaves every Payouts field (channel, country, currency, account holder
  name, mobile network, phone) byte-for-byte unchanged after reload, and
  vice versa; tab click + Left/Right/Home/End keyboard nav works; no
  horizontal overflow at 390px; `npm run build`/`npm test` clean (101/101).
  Also fixed a layout bug this composition surfaced: nesting
  `CauseProfileForm`'s/`PayoutSettingsForm`'s own already-boxed
  `.admin-form` inside a `Card`'s `CardContent` (itself given `.admin-form
  .admin-form--embedded` to strip its box, per the pattern in
  `components/admin/settings-form.tsx`) hits `.dashboard-main--brand
  .admin-form`'s `margin-left/right: auto` (meant to center a form that
  still has its own `max-width`) — once nested, `max-width` resets to
  `none` via the existing `.admin-form .admin-form` rule, and a CSS Grid
  item with auto margins and no max-width shrinks to fit-content and
  centers instead of stretching, leaving a narrow field column with large
  dead gutters on both sides. Fixed with a new CSS rule scoped to a
  `cause-tab-form` class (`app/globals.css`, placed after the centering
  rule it needs to outrank at equal specificity) — additive only, doesn't
  edit any existing shared `.admin-form` rule.
  **Seller half done too — both halves now confirmed fixed.**
  `components/seller-settings-panel.tsx` also converted to `Tabs`/`Card`
  (variant="brand") — a "Profile" tab and a "Payouts" tab. `SellerProfileForm`
  (`components/seller-profile-form.tsx`) was rewritten to be fully
  self-contained: its own `<form>`, its own fetch to `/api/seller/profile`,
  its own "Save changes" button — the old `forwardRef`/`useImperativeHandle`
  pattern was removed entirely since nothing needs to drive it externally
  anymore. `PayoutSettingsForm` (shared with the cause side) was left
  untouched — no prop/API change — and still only exposes an imperative
  `submit()`, so the Payouts tab keeps a `ref` and its own "Save payout
  settings" button that calls only that ref, never the profile form's.
  Neither `/api/seller/profile` nor `/api/seller/payout-settings` needed
  any change — they were already two separate PATCH endpoints.
  Verified live via Playwright against a real signup + seller onboarding +
  campaign + artwork flow: Profile/Payouts tabs render and switch
  correctly, Left/Right keyboard nav moves focus and activates the tab,
  editing the Bio field and clicking the Profile tab's own "Save changes"
  leaves every Payouts field byte-for-byte unchanged after reload, and
  editing Payouts fields and clicking "Save payout settings" leaves the
  just-saved Bio unchanged after reload — independent saves confirmed in
  both directions; no horizontal overflow at 390px on `/seller/profile`,
  `/seller`, or `/seller/artworks`; `npm run build`/`npm test` clean
  (101/101).
  Also ran into the *exact* layout bug flagged above for the cause side:
  nesting `SellerProfileForm`'s/`PayoutSettingsForm`'s own already-boxed
  `.admin-form` inside a `Card`'s `CardContent` (given `.admin-form
  admin-form--embedded` to strip its box) hits `.dashboard-main--brand
  .admin-form`'s centering rule the same way — confirmed live via
  `getBoundingClientRect()` before the fix: the Name/Country/Bio inputs sat
  in a ~521px column centered inside a ~796px-wide Card instead of
  stretching to fill it. Fixed the same way, with its own scoped class
  (`seller-tab-form` in `app/globals.css`, mirroring `.cause-tab-form`
  rather than reusing it, since the two panels are maintained
  independently) — additive only, doesn't edit the existing shared
  `.admin-form`/`.dashboard-main--brand` rules. Re-verified live after the
  fix: inputs now measure the full ~796px Card content width.
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
- [x] **Seller dashboard "Your listings" section renders nothing.**
  `app/seller/(dashboard)/page.tsx:124-131` — heading + "Manage all
  listings" button only, no actual content. Ships as dead space in both
  empty and populated states.
  **Done — built a preview, didn't remove the section.** The page already
  fetches every campaign with `artworks: true` for the campaigns section
  above it, so a "most recent 5 listings" preview costs no extra query —
  just `campaigns.flatMap((c) => c.artworks).sort(...).slice(0, 5)`. Each
  entry shows the artwork's image/title/price/inventory state; "Manage all
  listings" stays as the link through to the full `/seller/artworks` table
  for actual edit/delete. Verified live: created a real campaign + artwork
  through the seller UI and confirmed the new artwork appears in this
  preview immediately on the dashboard.
- [x] **Admin Campaigns page overflows horizontally on mobile.**
  `.admin-campaign-card header` / `.admin-campaign-card__controls`
  (`app/globals.css:2299-2311`) — no `flex-wrap`, no `min-width: 0`, unlike
  every comparable flex container elsewhere in the file that got this fix
  in the `@media (max-width: 720px)` block. Measured live: 487px content
  in a 390px viewport, controls clipped off-screen.
  **Done:** added `flex-wrap: wrap` + `min-width: 0` to both selectors.
  Verified live: `document.documentElement.scrollWidth` now exactly equals
  `window.innerWidth` (390 = 390) at 390px viewport, was 487 vs 390 before.
- [x] **The same inline-style flex-row string is copy-pasted verbatim 3
  times**, instead of a shared class: `app/seller/(dashboard)/page.tsx`
  (×2, lines 69 & 125) and `app/seller/(dashboard)/artworks/page.tsx:26`.
  **Done:** all 3 replaced with the new `Card`/`CardHeader`/`CardTitle`
  primitives. On `app/seller/(dashboard)/page.tsx`, "Your campaigns", "Your
  listings", and "Your sales" are each now a `Card variant="brand"` with a
  `CardHeader`/`CardTitle` (trailing action button, e.g. "Start a new
  campaign", laid out via `CardHeader`'s own built-in `justify-content:
  space-between`) and a `CardContent` body — real page structure instead of
  bare sibling `<section>`s with no container (`.impact-totals` was left as
  its own thing, unwrapped, per the audit's own call: it already has its
  own grid/stat-tile styling, and wrapping it in another bordered Card
  would just be a box nested in a box for no visual gain). On
  `app/seller/(dashboard)/artworks/page.tsx`, the page's real `<h1>` stayed
  an `<h1>` (using `CardTitle`, which is hardcoded to `<h2>`, would have
  left the page with no top-level heading at all) — just the wrapping div
  swapped for a bare `CardHeader` for the same flex/space-between layout,
  no `Card` box needed around a single `<table>` (matches the existing,
  audit-approved convention on `app/admin`'s own table pages, which don't
  wrap `.admin-table` in a Card either).
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

## Status: all findings closed

Every item above is fixed and independently re-verified (not just taken on
the fixing agents' word) — `npm run build` clean, `npm test` 101/101,
targeted e2e specs (`seller-management.spec.ts` 4/4,
`cause-management.spec.ts` 3/3, plus a broader sweep across
`admin-crud[-extended].spec.ts`/`onboarding.spec.ts`/
`storefront-browsing.spec.ts`/`login-redirect.spec.ts` — 24 tests, no
failures) all pass, and the seller/cause settings panels' actual source was
read directly, not just screenshotted.

One real regression this work introduced and then caught+fixed:
`tests/e2e/cause-management.spec.ts` still asserted the old shared
`getByRole("button", { name: "Save changes" })` — stale once the Cause
panel got its own distinctly-labeled "Save profile" button. Updated the
test to match (the seller side kept the label "Save changes" for its
Profile button, so `seller-management.spec.ts` needed no change).

One unrelated but real bug found and fixed along the way, not originally
part of this audit: `components/ui/text-block-animation.tsx` (used
site-wide, including every page via `PageTitle`) crashed with `React.
Children.only expected to receive a single React element child` in dev
mode — 100% reproducible, blocking `npm run dev` and `npm run test:e2e`
entirely (not previously caught because prior e2e runs in this session were
blocked by this exact bug, so this doc's own earlier verification passes
never actually got to run). Root cause: when a Server Component (e.g. a
`page.tsx` with no `"use client"`) passes JSX straight into this Client
Component, React serializes that `children` value as a special RSC "lazy"
wrapper crossing the server/client boundary — in dev mode that wrapper
isn't resolved into a plain element yet by the time `Children.only`/
`isValidElement` synchronously inspect it, so it throws even though exactly
one element is genuinely being passed (confirmed via debug logging: it
never failed for children built inside an already-`"use client"` caller,
like `Hero`, since no server/client handoff was involved there — only
crashed for children passed from a Server Component). Never affected
production (by the time a production build hydrates, the payload is
already resolved), which is why nothing in this whole session's extensive
production-build testing ever caught it. Fixed by not introspecting
`children`'s shape at all: render it normally inside a wrapper `<div>`, then
reach into the DOM for the one real child element in the GSAP effect
(`containerRef.current.firstElementChild`) once React has fully resolved
everything, instead of `Children.only`/`isValidElement`/`cloneElement` at
render time.
