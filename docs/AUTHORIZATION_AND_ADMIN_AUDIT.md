# Authorization and administrative audit

## Route-level authorization

Administrative API routes perform their own permission checks instead of
relying only on navigation visibility or layout guards. Sensitive operations
require the appropriate admin or finance permission before reading or mutating
data.

Artist routes similarly validate the authenticated artist and scope reads and
writes to that artist's records.

The proxy remains defense in depth; it is not the sole authorization boundary.

## Audited mutations

Admin and artist mutations record actor, action, target entity, reason, and
relevant metadata. Covered areas include users, settings, inquiries, orders,
payouts, campaigns, artists, conservancies, animals, news, artworks, artist
profiles, onboarding, payout settings, and payment actions.

## Data isolation

Public pages receive only public artwork/artist/campaign fields. Bidder details,
provider payloads, payment records, and internal security evidence are restricted
to authorized staff. Route handlers must continue to apply ownership checks
even when a record ID is supplied directly by a client.

## Review surfaces

- `/admin/activity` — searchable audit activity with pagination and entity links.
- `/admin/security` — security cases and triage.
- `/admin/reconciliation` — payment exceptions and provider events.
- `/admin/offers` — sealed offer review.
- `/admin/share-analytics` — aggregate sharing activity.
