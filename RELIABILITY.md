# Lorki reliability model

This document distinguishes behavior that is implemented from behavior that is intentionally handled by an existing platform or business rule.

| Concern | Lorki behavior |
| --- | --- |
| Graceful shutdown | `server.cluster.js` drains workers on SIGTERM/SIGINT, stops respawning workers during shutdown, and force-exits after a bounded ten-second drain window. |
| Debouncing/coalescing | Infinite-scroll uses an IntersectionObserver plus an in-flight guard; repeated sentinel events cannot create concurrent page loads. In-flight page requests are aborted when the grid is replaced/unmounted. Once the last remote page is reached, it stops requesting that page and appends rate-limited local repeats from the loaded catalogue. Search is submitted as a server action rather than issuing a request per keystroke. |
| Optimistic UI | Financial mutations are deliberately pessimistic: the UI shows pending state and updates only after the server confirms. Optimistic mutation is not safe for reservations, payment, payout, or inventory state. |
| Feature flags | `lib/feature-flags.ts` provides explicit environment flags. Existing capabilities default on so adding the boundary cannot silently disable auctions, payouts, analytics, or infinite scroll; explicit `false` disables a known flag and malformed values fall back to that existing default. The originals page, its paging endpoint, auction writes, payout dispatch, and share analytics enforce the relevant flags server-side. |
| Graceful degradation | Email is best-effort, the decorative carousel is cached separately from live inventory, and failed automatic payouts remain manual obligations without changing the RELEASED ledger state. |
| Circuit breaker | Flutterwave transfers use a bounded 15-second request timeout and a closed/open/half-open breaker after repeated dependency failures. Non-2xx provider responses are raised as provider failures, so retryable 408/429/5xx responses participate in both the bounded retry policy and breaker threshold; only one half-open probe is allowed at a time. |
| Cold start | Prisma is a process singleton and read-heavy storefront data uses bounded Next cache windows; authoritative inventory and checkout paths remain uncached. `DATABASE_POOL_MAX` makes the per-worker connection budget explicit for clustered deployments. |
| Database contention/deadlock | Rate-limit transactions use PostgreSQL advisory locks and now retry transient serialization/deadlock/pool failures with bounded backoff. Other transactions still require provider-specific retry policies where contention is expected. |
| N+1 queries | Storefront and admin aggregates use `include`, `Promise.all`, `count`, `groupBy`, and pagination. This is a prevention pattern, not a universal detector; query plans should still be checked for new endpoints. |
| Race conditions | Idempotency keys, row locks for offers/reservations, transactional rate limiting, unique constraints, stale-winner checks, and single-probe circuit recovery protect the money/inventory/dependency paths. UI request ownership should still cancel stale reads when adding new interactive flows. |

## Test and request-context hardening

Admin handlers are tested at the handler boundary with the same authentication
mechanism used in production. Each handler accepts the incoming `Request` and
passes it to `getCurrentUser(request)`, which extracts and verifies the signed
session cookie before loading the current database role. This avoids calling
Next's request-scoped `cookies()` API outside a request while preserving the
unauthenticated denial path. The shared fixture in
`lib/__tests__/test-auth.ts` creates a dedicated signed `SUPER_ADMIN` row; it
does not bypass authorization or manufacture a default localhost session.

The test runner uses one file at a time because the integration suite shares a
Neon database. The rate-limit test still sends twenty calls concurrently. Its
implementation queues same-key work locally, takes a PostgreSQL transaction
advisory lock across workers, and uses bounded transaction wait/retry. This
prevents both logical over-admission and test-only connection storms.

API validation failures use the versioned `{ error: { code, message } }`
envelope when the route has migrated to the contract. Tests assert the
machine-readable message rather than depending on a flat string, while legacy
routes remain explicitly documented until migrated.

## Boundaries

Lorki cannot make a database provider, payment provider, CDN, or deployment platform perfectly available. Provider webhooks, external WAF logs, Postgres metrics, and process supervision remain operational evidence outside the application process.
