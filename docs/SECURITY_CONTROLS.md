# Lorki Security Controls and Verification

This document records the security controls currently implemented in Lorki, the boundary each control protects, and the evidence needed before treating the control as production-ready.

## Request and JSON boundaries

Mutation routes use `readJsonObject` from `lib/request-json.ts`. It rejects malformed JSON, arrays, primitive values, and bodies larger than 1 MiB before application logic runs. Routes then apply field-specific validation and authorization.

The migration covers public mutation routes, artist and cause routes, and admin CRUD routes. The Flutterwave webhook keeps provider-specific raw-payload handling because its signature and event envelope are external-provider concerns.

This protects against oversized-body denial of service, parser exceptions becoming 500 responses, and unvalidated fields reaching business logic. It does not replace authorization or field validation.

## XSS and browser boundaries

React renders database values as text by default, so artwork stories, bios, news, inquiries, and labels are escaped during rendering. User content must not be passed to `dangerouslySetInnerHTML`.

URL validation accepts only HTTP and HTTPS schemes. `javascript:`, `data:`, `file:`, and other active schemes are rejected. SVG uploads are disabled because unsanitized SVG can contain active content. PDFs are served as downloads rather than inline documents.

The response policy includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `object-src 'none'`, and a per-request CSP nonce for the two intentional bootstrap scripts in `app/layout.tsx`. Images are limited to same-origin, HTTPS, data, and blob sources.

Focused regression coverage is in `lib/__tests__/xss-boundaries.test.ts`.

## Authentication, sessions, and authorization

Sessions contain a version value checked against the database. Password reset, account suspension, deletion, restoration, and lifecycle changes increment that version, invalidating older cookies.

Admin, artist, and cause routes authenticate before mutation. Artist artwork and sale-setting operations scope resource lookup through the authenticated artist ID. Cause operations scope updates through the authenticated conservancy profile. Admin routes check permissions before resource mutation.

Account deletion is a suspended/anonymized lifecycle, not an immediate physical erase. Retention preserves financial, payout, reconciliation, security, deletion-request, and audit records while removing personal authentication data after the configured retention period, except where a legal hold applies.

## Abuse controls

Login, signup, password reset, inquiries, share events, search suggestions, catalogue requests, and uploads have rate limits. Catalogue and suggestion queries are bounded, paginated, and server-side. Client-side search cancels stale requests and ignores late responses so an older response cannot replace newer results.

Upload limits include an 8 MiB maximum, allowed media types, and file-signature checks for raster images and PDFs. Raster images are reprocessed before storage.

## Payments and webhooks

Stripe webhooks verify the provider signature, record events in an immutable provider-event inbox, and make financial side effects idempotent. Flutterwave transfer events use the configured provider verification secret and the same event/reconciliation model.

The browser success page is not treated as proof of payment. Order, payout, reconciliation, and notification changes are driven by verified provider events.

## Database and migrations

Neon currently contains all 43 local migrations. Checksums match the local migration files; no migration is rolled back or unfinished. The previous deployment failure was a stale Prisma advisory lock held through the Neon pooler. Releasing that lock allowed `prisma migrate deploy` to complete with `No pending migrations to apply`.

## Verification status

Completed checks:

- TypeScript compilation
- `git diff --check`
- Full `npm test` command exits successfully
- Focused authorization, security-control, password, and XSS tests
- Neon migration count, completion, and checksum verification

Still required before a security sign-off:

1. Run the live app with a reachable browser process and verify CSP nonce headers and script attributes together.
2. Execute Playwright authorization tests for cross-user, artist, cause, and admin boundaries.
3. Run ZAP or an equivalent dynamic scan against the deployed app.
4. Add dependency, secret, and supply-chain scanning to CI.
5. Test backup restoration and incident credential rotation in the deployment environment.

## Review rule

No security control is marked complete solely because its source code looks correct. A control is complete when its implementation, focused regression test, and live or database-backed verification evidence all exist.
