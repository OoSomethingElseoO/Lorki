# Reliability patterns

This document records the reliability behavior implemented in Lorki, the
boundary of each guarantee, and the checks used to validate it. It is a
technical runbook, not a promise that the database, payment providers, or
hosting platform are always available.

## Pattern map

| Pattern | Current implementation | Evidence / limit |
| --- | --- | --- |
| Graceful shutdown | `server.cluster.js` stops respawning workers, asks workers to drain, and force-exits after 10 seconds. | Process-level behavior is implemented; a deployment still needs a termination grace period at least as long as the drain window. |
| Debouncing / coalescing | Originals infinite scroll uses an `IntersectionObserver` and an in-flight guard; repeated sentinel events cannot start concurrent page loads. | This is not a universal debounce for every input. New search/typeahead flows need their own debounce or server-action design. |
| Optimistic UI | `useOwnedMutation` provides optimistic apply, rollback, cancellation, and generation checks. It is used for reversible admin status changes. | Payment, reservation, inventory, and payout mutations remain pessimistic intentionally. See `OPTIMISTIC_UI.md`. |
| Feature flags | `lib/feature-flags.ts` defines explicit flags. Existing capabilities default on; `FEATURE_NAME=false` disables a known feature. | Flags are configuration gates, not authorization. They must never replace permission checks. |
| Graceful degradation | Email and automatic payout failures remain recoverable; live inventory and checkout use authoritative uncached paths; decorative/catalogue UI can degrade independently. | A degraded dependency must be visible to operators; degradation must not silently mark money or inventory successful. |
| Circuit breaker | `CircuitBreaker` provides CLOSED, OPEN, and HALF_OPEN states. Flutterwave uses a bounded timeout and breaker. | Breakers are process-local. Multiple replicas need provider metrics and external alerting as well. |
| Cold start | Prisma is a process singleton and read-heavy catalogue paths use bounded cache windows. | Checkout, availability, and reservation decisions must not use stale catalogue caches. |
| Database contention | `withDatabaseRetry` retries recognized transient serialization/deadlock/pool errors with bounded exponential backoff and jitter. | It is not a blanket retry for every transaction. Operations must remain idempotent or be protected by a transaction/unique key. |
| N+1 queries | Storefront paths batch related data with `include`, `Promise.all`, `count`, `groupBy`, and pagination. | This is a design rule plus regression coverage, not a runtime detector for every new query. Inspect query plans when adding a route. |
| Race conditions | PostgreSQL transactions, advisory locks, row locks, unique constraints, idempotency keys, and stale-winner checks protect commerce paths. | UI races need ownership/generation checks; distributed workers need leases and idempotent side effects. |

## Operational checks

Run the focused reliability tests:

```bash
npx tsx --test \
  lib/__tests__/reliability.test.ts \
  lib/__tests__/owned-mutation.test.ts \
  lib/__tests__/feature-flags.test.ts \
  lib/__tests__/outbox.test.ts
```

Check the process locally:

```bash
npm run build
PORT=3001 npm run start
curl -i http://127.0.0.1:3001/api/health/live
curl -i http://127.0.0.1:3001/api/health/ready
```

The liveness endpoint must not query Postgres. Readiness must return `503`
when the database cannot answer `SELECT 1`. A deployment must send SIGTERM,
stop accepting new work, allow in-flight work to finish, and only then kill
the process.

## Failure policy

Retries are allowed only for failures that are likely transient. Never retry a
payment, payout, email, or webhook side effect without an idempotency key or a
durable state transition. A circuit-open response means the dependency is
temporarily unavailable; it is not proof that the business operation failed
permanently.

## Remaining boundary work

- Run a real termination test in the production process supervisor.
- Add provider/database fault injection to CI with disposable dependencies.
- Add a query-plan budget for the highest-volume catalogue and admin routes.
- Configure external alerting for readiness failures, breaker-open events,
  outbox backlog, and repeated database retries.
