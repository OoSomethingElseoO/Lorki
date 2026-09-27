# Transactional outbox and webhook processing

Lorki separates durable business-state changes from external side effects.
Payment/webhook transactions write the authoritative order state and enqueue
an outbox job in the same database transaction. A separate scheduler drains
the job after commit.

## Outbox lifecycle

`OutboxJob.status` follows:

```text
PENDING → PROCESSING → COMPLETED
                    └→ PENDING (retry)
                    └→ FAILED (five attempts exhausted)
```

`dedupeKey` is unique. `enqueueOutboxTx` treats a duplicate key as an already
durable job and allows the parent transaction to remain idempotent. Jobs carry
the minimum payload needed by the handler; do not put secrets or complete
provider responses into the payload.

The worker reclaims `PROCESSING` jobs older than five minutes, caps a batch at
50, and marks jobs with five attempts as terminal `FAILED`. Failed jobs are
delayed by 30 seconds between attempts. The internal route rejects requests
without `OUTBOX_WORKER_SECRET` and returns `429` when pending/processing work
reaches the 1,000-job safety limit.

## Current job types

`ORDER_CONFIRMATION_EMAIL` is implemented. Unknown kinds fail explicitly so a
new side effect cannot be silently discarded. Adding a job requires:

1. A stable kind constant.
2. A dedupe key derived from the business event ID.
3. A transactional enqueue call.
4. A handler with a provider idempotency key where supported.
5. A retry/permanent-failure policy.
6. An operator view or alert for `FAILED` jobs.

## Webhook inbox

Provider webhook routes record event identity before applying business effects.
Already `PROCESSED` or `RECEIVED` events are ignored; `FAILED` events may be
reprocessed. Signature validation and provider-specific parsing happen before
the business transaction. A webhook retry must not create a second order,
payout, or email.

## Scheduling and operations

`.github/workflows/operational-sweeps.yml` invokes:

```bash
POST /api/internal/outbox?limit=50
x-outbox-worker-secret: $OUTBOX_WORKER_SECRET
```

Configure `QAFORGE_BASE_URL` and `OUTBOX_WORKER_SECRET` as repository secrets.
The scheduler is an execution mechanism, not proof that delivery succeeded;
monitor backlog, processing age, and `FAILED` counts.

## Verification

```bash
npx tsx --test \
  lib/__tests__/outbox.test.ts \
  lib/__tests__/webhook-inbox.test.ts
npx prisma validate
```

The focused tests validate bounded limits and duplicate policy. A live drill
must enqueue a disposable job, invoke the internal endpoint, verify completion,
then force a provider failure and verify retry/reclaim/terminal failure. Do not
run that drill against real customer email or production payment events.

## Failure boundary

The outbox provides at-least-once delivery, not exactly-once delivery. External
handlers must therefore be idempotent. A worker crash after provider delivery
but before marking `COMPLETED` can cause a retry; provider idempotency keys or
dedupe at the recipient are required to make that safe.
