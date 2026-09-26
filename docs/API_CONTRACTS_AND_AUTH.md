# API contracts and authorization

## Contract

Versioned responses use `x-api-contract-version: 1`. New or migrated errors
have this shape:

```json
{"error":{"code":"INVALID_PAGE","message":"page must be positive"}}
```

Successful payload shapes are preserved to avoid breaking existing clients.
The shared helpers live in `lib/api-contract.ts`; `apiContractError` creates a
stable machine-readable error and `apiJson` adds the response header.

The highest-risk public/auth/payment routes are migrated: checkout, inquiries,
offers, login, signup, password reset/recovery, uploads, originals, webhooks,
share analytics, and idempotency/prisma error paths. The admin animal,
conservancy verification, co-op, news, artist, campaign, campaign-artwork,
sale-settings, admin-access, order fulfillment, payout, reconciliation,
security-case, share-analytics, artist, and cause routes now also use the
envelope and explicit request-scoped authentication. Internal maintenance
handlers and any route not covered by the route tests must still be reviewed
before being treated as contract-compliant; the scan is not a substitute for
behavioral tests.

## Authorization and isolation

`lib/authorization.ts` centralizes artist/campaign/artwork and conservancy
ownership queries. Admin orders and order/payout exports now enforce the
appropriate `OPS_ADMIN` or `FINANCE_ADMIN` permission. Artist and conservancy
self-service routes resolve records through the authenticated profile rather
than trusting IDs supplied by the browser.

A not-found response is intentionally used for cross-owner records so the API
does not disclose whether another user's object exists. Financial and inventory
mutations retain transactional locks and idempotency protection.

## Adding a route

1. Authenticate and authorize before loading user-owned data.
2. Query through the ownership relation in Prisma; do not load by ID and check
   ownership afterward.
3. Return `apiContractError` for failures and `apiJson` for successful JSON.
4. Add an authorization test for missing profile, wrong owner, and permitted
   owner cases.

### Direct route-handler tests

When a route handler is imported and invoked directly, Next middleware does not
run and there is no implicit request scope for `cookies()`. Admin handlers
therefore accept the `Request` object and call `getCurrentUser(request)`. Tests
must pass a real signed cookie, not a localhost default, environment bypass,
or mocked authorization result. Use the shared fixture in
`lib/__tests__/test-auth.ts`:

```ts
before(initTestAdmin);
const response = await GET(
  new Request("https://test.invalid/api/admin/news", {
    headers: adminHeaders(),
  }),
);
```

The fixture is a dedicated database row, signs a normal session token, and
retries only transient Neon connection failures. Tests that verify denial must
send no cookie. This keeps the test boundary equivalent to production rather
than hiding request-context bugs.

## Migration record

The route migration was completed in bounded batches. The following groups now
use `getCurrentUser(request)` and the versioned error envelope:

### Public and account routes

- signup and login
- password recovery and reset
- checkout and idempotency responses
- uploads and uploaded-file access
- original listings and public offers
- inquiry creation
- share-event analytics
- Stripe and Flutterwave webhook signature failures

### Operations administration

- animals, conservancies, co-ops, and news CRUD
- artist and campaign CRUD
- campaign artwork create, update, delete, and sale settings
- conservancy verification
- admin-user creation and admin-access revocation
- inquiry listing, status changes, bulk status changes, and approved-inquiry checkout
- offer listing, winner acceptance, and winning-offer checkout
- order listing, cash-sale recording, shipping, delivery, and refunds
- payout marking, revival, and bulk marking
- reconciliation listing, case triage/resolution, and settlement imports
- security-case listing and triage updates
- settings and share-analytics administration
- CSV order and payout exports

### Artist and cause self-service

- artist and cause onboarding
- artist and cause profile updates
- artist and cause payout settings
- artist and cause artwork and sale-settings mutations
- artist campaign creation and listing
- artist sales listing
- Stripe Connect onboarding and return handlers

### Contract behavior

Authentication is resolved from the signed session cookie in the supplied
request. Role and ownership checks still come from a fresh database read; the
session token is not treated as an authorization cache.

Failure responses use the stable shape below. The status remains meaningful to
HTTP clients, while `code` gives clients a non-localized branch key:

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "Artwork is no longer available"
  }
}
```

Common codes now used by the migrated routes include `UNAUTHORIZED`,
`FORBIDDEN`, `VALIDATION_ERROR`, `INVALID_INPUT`, `NOT_FOUND`, `CONFLICT`,
`SERVICE_UNAVAILABLE`, `UPSTREAM_ERROR`, `PAYLOAD_TOO_LARGE`, and
`INTERNAL_ERROR`. Successful JSON responses retain their existing top-level
fields; the contract header is added without forcing a client payload rewrite.

### Verification status for this migration

The static audit after the final batch found no real `getCurrentUser()` calls
without a request argument under `app/api`; the only remaining match is a
comment in the login route. TypeScript compilation and `git diff --check` pass.

The full database-backed suite previously reached 141 tests with 135 passing;
the six failures were setup failures while Neon was unreachable (`P1001`),
including admin-user and artist-profile fixtures. Those failures must be
rerun after database connectivity is restored. A passing typecheck or static
scan is not a substitute for that database-backed verification.

When adding a new route, update this migration record only after both checks
exist: a request-scoped authorization test and a response assertion for the
versioned error envelope.

## Account and role-entry flow

Signup creates one ordinary `User` account. The normal `/signup` page does not
ask the visitor to choose a role and does not create an artist or conservancy
record. After signup, the user enters `/account`, where artwork/order activity
and the available next actions are shown.

Artist onboarding is an optional capability attached to that same account. The
account dashboard exposes `Start selling`, which opens `/artist/onboarding` and
creates the linked `Artist` record after the artist form is completed. The user
continues to be a customer and can still browse, buy, and view order history.

Cause registration has its own public entry point at `/cause/signup`. That page
uses the same base account creation endpoint, then continues to
`/cause/onboarding` for organization details and registration evidence. An
already-authenticated user is sent directly to cause onboarding so they cannot
accidentally create a second account.

Artist and conservancy profiles are independent optional records. A single
person may be a customer, artist, conservancy representative, and—if granted—
an administrator. The frontend therefore shows each missing capability as an
independent action instead of treating artist and cause registration as a
mutually exclusive choice.

## Verification

```bash
node --import tsx --test lib/__tests__/api-contract.test.ts \
  lib/__tests__/authorization.test.ts
npx tsc --noEmit --pretty false
npm test
```
