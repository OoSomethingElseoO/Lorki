# Local security audit — 2026-09-21

## Scope

Lorki was run only on `127.0.0.1` with a disposable PostgreSQL 16 database.
All dynamic requests below passed through Burp Suite. No production or hosted
database was used.

## Fixed findings

### High — login rate limit could be bypassed with concurrent requests

The database-backed limiter counted and inserted inside a normal `READ
COMMITTED` transaction. Twenty simultaneous invalid logins allowed seven
requests, although the configured maximum is five.

`lib/rate-limit.ts` now obtains a PostgreSQL transaction advisory lock scoped
to the rate-limit key before cleanup, count, and insert. The regression test
covers 20 concurrent calls. Burp retest: **5 × 401, 15 × 429**.

### Medium — guest idempotency keys did not replay responses

`IdempotencyStore.userId` was nullable. PostgreSQL treats nulls as distinct in
a unique index, and Prisma cannot perform a compound-unique lookup with a null
member. Anonymous inquiries therefore logged a storage failure and could not
replay an idempotent response.

Guests now use the explicit `__guest__` scope, backed by a migration that
deduplicates legacy null guest records before making the column non-null.
Requests without `Idempotency-Key` are no longer stored under a fabricated
fallback key. Burp retest: submitting the same guest inquiry twice returned
the same inquiry ID both times.

## Controls verified through Burp

- Unauthenticated admin API request: **401**.
- Cross-origin mutation and mutation with no Origin/Referer: **403**.
- Invalid SQL-injection-shaped login email: **400** validation rejection.
- Unsigned Stripe and Flutterwave webhook requests: **400**.
- Password reset response does not reveal account existence: both known and
  unknown local addresses returned **200**.
- Sequential login throttling: five **401** responses, then **429**.

## Code-review observations

- User-controlled content is rendered by React's normal escaping path; the
  only `dangerouslySetInnerHTML` uses are static script payloads. No dynamic
  HTML sink was identified in the reviewed application code.
- `getRequestIp()` and same-origin reconstruction trust forwarded headers.
  Production infrastructure must strip client-supplied `X-Forwarded-For`,
  `X-Forwarded-Host`, and `X-Forwarded-Proto` and set its own trusted values.
  Exposing the Next.js process directly would let clients spoof these headers,
  weakening IP-based throttling and origin reconstruction.

## Verification

- `npm test`: **113 passed**.
- Focused idempotency and rate-limit regression tests: **6 passed**.
- Playwright: **33 passed, 2 fixture-assumption failures** on a clean local
  seed. The failures are not security failures: one uses `Ethiopia` despite
  the UI requiring a two-letter country code; one assumes more than 12 artists
  while the local seed contains fewer.

## Tool-assisted baseline

- An Nmap TCP connect scan of `127.0.0.1` found only the intended audit
  services: Lorki (`3001/tcp`), Burp (`8080/tcp`), and the disposable
  PostgreSQL database (`54329/tcp`). The database is bound to localhost.
- `npm audit --omit=dev` reported five production dependency advisories:
  two high (`fast-uri`, transitive through Prisma's development tooling; and
  `mysql2`, transitive through Prisma) and three moderate
  (`nodemailer`, `baseline-browser-mapping`, and the Prisma advisory chain).
  Do not apply the audit's suggested Prisma downgrade automatically; review
  Prisma's supported upgrade path and update the lockfile deliberately.
