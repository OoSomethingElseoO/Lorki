# Authorization and data isolation

Authorization has two layers: role permission and resource ownership. A valid
session is not enough to access another artist's artwork, campaign, payout, or
conservancy data.

## Shared boundary helpers

`lib/authorization.ts` centralizes ownership queries:

- `artistRequired` and `conservancyRequired` resolve profile boundaries.
- `loadArtistArtwork(artistId, artworkId)` scopes artwork through its campaign.
- `loadArtistCampaign(artistId, campaignId)` scopes the campaign to the artist.
- `loadOwnedConservancy(conservancyId, userId)` scopes the conservancy to its
  authenticated owner.

These helpers use a single constrained query. A missing row should be treated
as not found or forbidden according to the route's disclosure policy; do not
first load by ID and then check ownership in a separate uncontrolled query.

## Role permissions

`checkPermission` is the role boundary used by admin routes and pages. Typical
roles are `OPS_ADMIN`, `FINANCE_ADMIN`, and `SUPER_ADMIN`. Middleware protects
the broad admin surface, while pages and API handlers perform defense-in-depth
checks. A frontend-hidden button is not authorization.

Financial operations require finance permission. User administration requires
super-admin permission. Operational content and inquiry actions require ops
permission. The API must repeat this check because requests can be forged
without using the UI.

## Data-isolation rules

1. Derive the subject identity from the signed session, never from a client
   supplied `userId`, `artistId`, or `conservancyId`.
2. Scope the database predicate to both the resource ID and owner ID.
3. Do not return another user's email, offers, payment details, or private
   notes in public or bidder-facing responses.
4. Use neutral `404` responses where revealing resource existence would leak
   information.
5. Log sensitive administrative actions without logging passwords, payment
   tokens, or full provider payloads.

## Verification

```bash
npx tsx --test lib/__tests__/authorization.test.ts
```

Manual verification should use two seeded identities: request an artist-owned
resource as the correct artist, then repeat with another artist and confirm no
data is returned and no mutation occurs. Repeat for conservancy and finance
admin routes. Also test direct HTTP calls; page navigation alone is not proof.

## Limits and follow-up

Centralized helpers cover the migrated artist/conservancy and high-risk admin
paths. A route audit is still required whenever a new resource endpoint is
added. Database credentials or a compromised deployment account sit outside
application authorization and require secret rotation, database audit, and
incident-response controls.
