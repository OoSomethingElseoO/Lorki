# Lorkulup — Backend Product Requirements Document

Status: draft v0.1
Scope: everything the frontend needs from a real backend. No frontend/visual requirements in this doc.

## 1. Summary

Lorkulup sells original artwork and prints depicting named, individual African wildlife (starting with one lion, Lorkulup), painted by artists local to that animal's region. Every sale splits proceeds three ways: the artist who made the piece, the conservancy protecting the animal, and platform operations. The backend's job is to make that split real, auditable, and repeatable across many animals, artists, and conservancy partners — not just process one payment.

## 2. Goals

- Model animal, conservancy, artist, and split ratio as independent, recombinable data — not hardcoded per product.
- Take real payment for originals and prints via Stripe.
- Guarantee artist and conservancy payouts are correct, delayed until fulfillment is confirmed, and fully auditable (every dollar traceable to a released payout).
- Support three distinct fulfillment paths (founder-shipped inventory, freight-forwarded originals, print-on-demand) without different products needing different code paths.
- Publish real, verifiable impact numbers (total paid to artists, total paid to conservancies) sourced from the payout ledger, not marketing copy.

## 3. Non-goals (v1)

- No artist or conservancy self-service portal (they don't log in; operations enters/updates their records).
- No multi-currency support — USD only.
- No real-time inventory sync with third-party POD providers beyond what's needed to fulfill an order.
- No fraud/risk modeling beyond what Stripe provides out of the box.

## 4. Domain model

Full schema: `prisma/schema.prisma`. Summary of entities and why each exists:

| Entity | Purpose |
|---|---|
| `Conservancy` | Accountable conservation partner. Receives a share of sales for the animals it protects. Holds a payout account reference. |
| `CoOp` | Optional artist collective/local partner. Supplies and vouches for multiple artists; may be the shipping consolidation point for originals. |
| `Animal` | One named individual animal (e.g. Lorkulup). Belongs to one conservancy. |
| `Artist` | A working artist, optionally under a co-op. Has social links for provenance/credibility. |
| `Campaign` | The core recombinable unit: one `Animal` × one `Artist` × a split ratio (`artistPercent` / `conservancyPercent` / `operationsPercent`). Every artwork belongs to exactly one campaign and inherits its split. |
| `Artwork` | A sellable item — `ORIGINAL` (one-of-one, `inventoryState` tracked) or `PRINT` (unlimited, fulfilled per order). |
| `Order` | A single purchase: buyer, shipping address, amount, Stripe payment reference, status. |
| `Payout` | One line per recipient per order (artist / conservancy / operations). Held `PENDING` until the order ships, then `RELEASED` via a Stripe Transfer. This table is the audit trail behind every public impact number. |
| `Shipment` | Fulfillment record. `method` is one of `ORIGINAL_FOUNDER`, `ORIGINAL_FREIGHT`, `PRINT_POD` — see §7. |

Why split lives on `Campaign` and not globally: different animals/artists may justify different ratios (an endangered species, or a first-time artist, may warrant a different split than the default 50/25/25). The default should be a constant used when creating a campaign, not a rule enforced in code.

## 5. Functional requirements

### 5.1 Campaign management
- Operations can create a `Conservancy`, `CoOp`, `Animal`, and `Artist` independently, then combine an `Animal` + `Artist` + split into a `Campaign`.
- A `Campaign` has a status (`DRAFT` → `LIVE` → `PAUSED`/`ARCHIVED`). Only `LIVE` campaigns' artworks are visible/purchasable on the storefront.
- Split percentages must sum to 100; reject creation otherwise.

### 5.2 Catalog
- Artworks are always created under a campaign (no orphan artwork).
- `ORIGINAL` artworks: `inventoryState` moves `AVAILABLE` → `RESERVED` (cart/checkout in progress) → `SOLD` on payment confirmation. A sold original is removed from the storefront.
- `PRINT` artworks: no inventory limit; each order triggers a new fulfillment job with the POD provider.

### 5.3 Checkout & payment
- Checkout creates a Stripe Checkout Session (or Payment Intent) for the artwork's price, collecting buyer email and shipping address.
- On `ORIGINAL` checkout start, reserve the artwork (`RESERVED`) for the session duration to prevent double-sale; release the reservation if checkout isn't completed within a timeout (e.g. 30 minutes).
- On Stripe webhook `payment_intent.succeeded` (or `checkout.session.completed`): create the `Order` (`status = PAID`), mark the original `SOLD` if applicable, and create three `Payout` rows (`PENDING`) — artist, conservancy, operations — computed from the campaign's split at the artwork's sale price.
- Payment is a single charge to the platform's main Stripe account. Splitting does **not** happen at charge time — it happens at payout release (§5.4). This is deliberate: it lets us hold the artist/conservancy share until we know the item actually shipped, without needing Stripe Connect's destination-charge complexity on day one.
- All webhook handlers must be idempotent (Stripe retries deliveries; duplicate events must not double-create orders or payouts).

### 5.4 Fulfillment & payout release
- Operations marks an `Order` as `SHIPPED` (manually in v1; see §7 for method-specific detail) and attaches a `Shipment` record.
- Marking `SHIPPED` is the trigger that releases that order's `Payout` rows: each moves `PENDING` → `RELEASED`, and (where the recipient has a connected payout account) a Stripe Transfer is issued; where they don't yet (early-stage artists/conservancies without Stripe Connect access), release is recorded as `RELEASED` with a manual-payment note and reconciled outside Stripe (e.g. bank/M-Pesa transfer logged against the same `Payout` row).
- A `REFUNDED` order must reverse any `RELEASED` payouts if possible, and must never allow a `PENDING` payout tied to it to later release.

### 5.5 Impact / transparency reporting
- A public endpoint aggregates `Payout` rows by `recipientType` and by conservancy/animal: total paid to artists, total paid to each conservancy, count of pieces sold per campaign.
- These numbers must be computed from `RELEASED` payouts only — never from order totals — so the public claim ("X% goes to conservation") is always backed by money that has actually moved, not money that's merely been collected.

### 5.6 Notifications
- Buyer: order confirmation on payment, shipping notification with tracking (when available) on `SHIPPED`.
- Operations: internal alert on new `PAID` order (action needed: fulfill), and on any `Payout` release failure.

## 6. API surface (v1)

```
GET   /api/campaigns                  list LIVE campaigns with animal + artist + conservancy expanded
GET   /api/artworks                   list purchasable artworks (filter: kind, campaign)
GET   /api/artworks/:id
POST  /api/checkout                   { artworkId, buyerEmail, shippingAddress } → Stripe Checkout Session url
POST  /api/webhooks/stripe            Stripe event handler (payment_intent.succeeded, charge.refunded, ...)
GET   /api/impact                     aggregate payout totals for the public impact page

--- operations-only (authenticated) ---
POST  /api/admin/conservancies
POST  /api/admin/co-ops
POST  /api/admin/animals
POST  /api/admin/artists
POST  /api/admin/campaigns
POST  /api/admin/orders/:id/ship      { carrier, trackingNumber, method } → triggers payout release
POST  /api/admin/payouts/:id/retry    re-attempt a FAILED payout
```

## 7. Fulfillment methods (drives `Shipment.method`)

| Method | When | Mechanics |
|---|---|---|
| `ORIGINAL_FOUNDER` | Bootstrap phase | Founders already hold the physical piece (bought and shipped home in bulk ahead of sale). Domestic shipping only at order time. Lowest operational risk. |
| `ORIGINAL_FREIGHT` | Scaled phase | Co-op consolidates multiple sold originals locally and ships via a fine-art freight forwarder to a receiving point, then last-mile to buyer. Higher latency, needed once volume exceeds what founders can hand-carry/ship themselves. |
| `PRINT_POD` | Always, for prints | Order routes to a print-on-demand API (e.g. Printful/Gelato) with the artwork image; POD partner prints and ships regionally to the buyer. No international physical leg for prints, ever. |

## 8. Integrations

- **Stripe** — payments (Checkout/Payment Intents) and, later, Connect for automated recipient payouts once a conservancy/co-op has a connected account. Webhooks are the source of truth for order state, not client-side confirmation.
- **Print-on-demand provider** (Printful or Gelato, TBD) — receives print orders, returns fulfillment/tracking status via their webhook or polling API.
- **Transactional email** (e.g. Postmark/Resend) — order and shipping notifications.
- **Freight forwarder** — v1 is manual (no API integration); revisit once `ORIGINAL_FREIGHT` volume justifies it.

## 9. Non-functional requirements

- **Payment data never touches our servers** — Stripe Elements/Checkout handles card entry; we store only Stripe references (payment intent ID, customer ID).
- **Idempotency** on all webhook and payout-release logic — duplicate Stripe events or a double-click "mark shipped" must not double-pay anyone.
- **Auditability** — every payout is a persisted row with status and timestamp; the impact page and any future financial/tax reporting reads from this ledger, never recomputed from orders.
- **PII handling** — buyer shipping address and email are the only PII stored; no payment card data, ever.

## 10. Rollout phasing

| Phase | Scope |
|---|---|
| 0 | One campaign (Lorkulup × one artist), one conservancy. Manual payout release (founders transfer money by hand), `ORIGINAL_FOUNDER` shipping only. Backend just needs `Order` + a manual "paid out" checkbox — prove the loop works before automating it. |
| 1 | Add `PRINT` artworks via POD integration. Removes shipping risk for the higher-volume item. |
| 2 | Add a second campaign (new animal/artist/conservancy) to prove the data model actually generalizes, not just holds one hardcoded story. |
| 3 | Automate payout release via Stripe Connect for partners who can receive it; keep manual reconciliation for those who can't (e.g. M-Pesa-only artists). |
| 4 | `ORIGINAL_FREIGHT` shipping via co-op consolidation once volume exceeds founder-handled capacity. |

## 11. Open decisions (block implementation until answered)

- **Database hosting**: local Postgres for dev is fine; need a decision on hosted provider (Supabase / Neon / Railway) before anything beyond local dev.
- **Stripe Connect account type for Kenya-based recipients**: Stripe Connect payouts to Kenya are limited — confirm whether conservancy/co-op accounts can receive Stripe Transfers directly, or whether payout must route through a partner rail (Wise, or the co-op's own bank/M-Pesa) with Stripe only tracking the obligation, not executing the transfer.
- **Legal entity & tax treatment**: how the operations LLC/co-ownership structure books outbound conservancy payments (COGS-like pass-through vs. donation) — affects whether `Payout` needs any additional tax-reporting fields (e.g. 1099 tracking) now or later.
- **POD provider**: Printful vs. Gelato — affects the exact integration contract in §8.

## 12. Success metrics

- Every `LIVE` campaign has at least one `RELEASED` payout to both its artist and its conservancy within 30 days of first sale (proves the loop closes, not just collects money).
- Zero instances of a payout released before its order's `Shipment` exists.
- Public impact numbers reconcile exactly against the `Payout` ledger on audit (no drift between what's claimed and what's recorded).
