# Reliability and failure modes

This document records how Lorki handles lifecycle, concurrency, dependency
failure, and frontend mutation failures. It distinguishes implemented behavior
from controls that still require deployment configuration.

## Runtime and dependency controls

- `server.cluster.js` drains workers on `SIGTERM`/`SIGINT`, stops respawning
  during shutdown, and force-exits after a bounded ten-second deadline.
- Flutterwave and email calls use bounded timeouts and circuit breakers.
- External retries are limited to transient failures; non-transient provider
  errors are returned immediately.
- Database retry logic handles transient serialization/deadlock/pool errors
  with bounded backoff. It does not retry permanent constraint errors.
- The Postgres pool defaults to five connections per Node process, with a
  ten-second connection wait. `DATABASE_POOL_MAX` can raise that limit only
  when the database connection budget has been reviewed for the number of
  clustered workers.
- `/api/health/live` checks process liveness without touching Postgres.
- `/api/health/ready` executes `SELECT 1` and returns `503` when the database is
  unavailable.

## Durable side effects

Payment webhooks update business state and enqueue confirmation email in the
same transaction. `OutboxJob` provides deduplication, leases, five-attempt
retry limits, stale-worker recovery, and terminal `FAILED` state. The scheduled
worker is protected by `OUTBOX_WORKER_SECRET` and returns `429` when backlog
exceeds the safety threshold.

## UI concurrency

`useOwnedMutation` provides optimistic apply, rollback, cancellation, and
generation checks so stale responses cannot overwrite newer state. It is used
for inquiry/security-case actions and non-financial campaign/news status
changes. Payment, inventory, reservation, and payout mutations remain
pessimistic deliberately.

## Query and race controls

Storefront queries use bounded pagination, includes/aggregates, and query-budget
regression tests. Offers and reservations use transactional locks,
idempotency keys, unique constraints, and stale-winner checks. Infinite scroll
uses an in-flight guard to coalesce duplicate observer events.

The Postgres rate limiter has two layers of serialization. A process-local
per-key queue prevents one worker from opening a burst of transactions for the
same key, while `pg_advisory_xact_lock` preserves correctness across workers.
The transaction uses a bounded ten-second pool wait and fifteen-second
transaction timeout, and transient lock, serialization, pool, and timeout
failures use bounded exponential retry. A failed attempt never records a hit.

Admin route handlers accept the request explicitly and read its signed session
cookie. This is required when a handler is called directly in a Node test,
where Next's request-scoped `cookies()` API does not exist; it does not weaken
production authentication. The test fixture creates one dedicated, signed,
database-backed `SUPER_ADMIN` account and retries only transient Neon errors.
Unauthenticated test requests still omit the cookie and exercise the denial
path.

## Verification

```bash
node --import tsx --test lib/__tests__/reliability.test.ts \
  lib/__tests__/owned-mutation.test.ts \
  lib/__tests__/outbox.test.ts
npx prisma validate
npm test
```

The full Node suite currently passes 141/141 tests against Neon. The suite is
configured serially to avoid making test scheduling itself a source of Neon
pool contention; the rate-limit test still exercises twenty concurrent calls
inside one process.
