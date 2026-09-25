# Deployment

## What's here

A `Dockerfile` using Next.js's `output: "standalone"` mode — builds a minimal production image regardless of host (a VPS, Railway, Fly.io, Render, self-managed). This is infrastructure readiness, not a deployment: nothing here provisions a server or a database for you.

## Required environment variables

Set these at runtime, on whatever host runs the container (not baked into the image, and not needed at build time — see below):

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | Yes | Postgres connection string. Runtime only — see the build-time note below. |
| `SESSION_SECRET` | Yes | Random string signing the login session cookie. Generate with `openssl rand -base64 32`. |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Once | Only read by `prisma db seed`, to create the very first admin account. Not checked at runtime — after that first login, manage admins from `/admin/users`. |
| `STRIPE_SECRET_KEY` | No | Can be left unset and entered later via `/admin/settings` (DB value overrides env). |
| `STRIPE_WEBHOOK_SECRET` | No | Same — set via `/admin/settings` once a webhook endpoint is registered in the Stripe dashboard. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OPERATIONS_EMAIL` | No | Same — settable via `/admin/settings`. |
| `RECONCILIATION_CRON_SECRET` | No | Required to call the internal rolling reconciliation sweep. Store it in the scheduler, never in client code. |
| `SECURITY_ALERT_CRON_SECRET` | No | Required to run threshold-based security alerts from an external scheduler. |
| `AUDIT_EXPORT_SECRET` | No | Required to export audit/provider events to an external Object-Lock/WORM archive job. |

### GitHub Actions scheduler

For the complete frontend-versus-provider boundary and setup checklist, see
[OPERATIONS_SETUP.md](./OPERATIONS_SETUP.md).

The repository includes `.github/workflows/operational-sweeps.yml`. It runs the
reconciliation and security-threshold endpoints hourly, then exports the prior
two days of audit/provider events to an S3 Object Lock bucket each night. The
two-day overlap makes a delayed event less likely to be missed; the export
endpoint itself remains idempotent at the archive-object level by timestamped
keys.

Configure these repository secrets before enabling the workflow:

- `QAFORGE_BASE_URL`
- `RECONCILIATION_CRON_SECRET`
- `SECURITY_ALERT_CRON_SECRET`
- `AUDIT_EXPORT_SECRET`
- `AUDIT_ARCHIVE_ROLE_ARN` (an AWS IAM role trusted by GitHub's OIDC provider)
- `AUDIT_ARCHIVE_AWS_REGION`
- `AUDIT_ARCHIVE_BUCKET` (an S3 bucket created with Object Lock enabled)

The workflow intentionally uses GitHub OIDC rather than a long-lived AWS access
key. Object Lock must be enabled when the bucket is created; the application
cannot turn that protection on after the fact. Review the seven-year retention
period with Kenyan counsel before production use.

## One real caveat, not glossed over

**Uploads are stored directly in Postgres (bytea), not object storage.** `POST /api/uploads` writes the file into the `UploadedFile` table and `GET /api/uploads/[id]` serves it back out — a deliberate choice made to avoid standing up a third-party storage account, not the default recommendation: serving artwork images out of the relational database instead of a CDN-backed object store is slower for visitors and inflates Neon's storage-based billing for exactly the content — artwork images — that gets browsed most. It does mean uploads work identically on every host with zero filesystem dependency at all (no ephemeral-disk caveat like a local-disk approach would have, which is why this replaced one). Reconsider real object storage (S3, R2) if upload volume or size ever makes this a real cost or performance problem — nothing else in the app needs to change if you do, since callers only ever see the `url` this route returns.

There used to be a second caveat here — the build needing live database access, because one page pre-rendered artist slugs at build time. That page renders dynamically now (same as everything else user-editable in this app), so the Docker build needs no database connectivity at all. This was a real failure on Render specifically: it doesn't pass secret environment variables into the `docker build` step, only into the running container, so `DATABASE_URL` was arriving as an empty string during the build and crashing `prisma generate`. Fixed at the root — `prisma.config.ts` falls back to a placeholder connection string when `DATABASE_URL` is unset (`prisma generate` only reads the schema file; it never actually connects), so the build no longer needs the real value at all.

## Database migrations

Migrations are not run automatically by the Docker image. Before (or as part of) each deploy:

```bash
npx prisma migrate deploy
```

against the target `DATABASE_URL`. Do this from a machine/CI step with network access to the production database — the running container doesn't do it for you. Run `npx prisma db seed` once afterward (with `ADMIN_EMAIL`/`ADMIN_PASSWORD` set) to create the first admin login.

## Reconciliation sweep

The finance dashboard reads a rolling 30-day window. A scheduler can also call the protected sweep to create explicit `MISSING_PROVIDER_PAYMENT` cases for `PAID` local orders that have a payment intent but no comparison row:

```bash
curl -X POST https://your-host.example/api/internal/reconciliation/sweep \
  -H "x-reconciliation-secret: $RECONCILIATION_CRON_SECRET" \
  -H 'content-type: application/json' \
  -d '{"days":30}'
```

This sweep does not contact Stripe or Flutterwave settlement APIs. It makes missing local comparisons visible; provider settlement imports remain a separate integration step.

Finance can import a provider settlement export through the admin endpoint using normalized rows (`externalId`, `amountCents`, `currency`, optional `eventType` and `observedAt`):

```bash
curl -X POST https://your-host.example/api/admin/reconciliation/import \
  -H 'content-type: application/json' \
  -d '{"provider":"STRIPE","rows":[{"externalId":"pi_…","amountCents":12500,"currency":"usd"}]}'
```

The endpoint requires a `FINANCE_ADMIN` session, is idempotent for the same provider/external ID/event type, and records the import batch in the audit log.

The external archive job can pull `/api/internal/audit/export?since=...` with `AUDIT_EXPORT_SECRET` and write the NDJSON response to an Object-Lock bucket. The app does not treat its own database as the immutable archive.

Run `/api/internal/security/alerts` hourly with `SECURITY_ALERT_CRON_SECRET` to evaluate refund, payout, admin-access, critical-case, and missing-record thresholds. Alerts are deduplicated for one hour through the append-only audit ledger.

## Log retention

Financial audit records and provider-event payloads should be retained for at least **7 years** as an operational default, but this is not the final legal policy: confirm the period against Kenyan tax/records obligations, the Data Protection Act’s storage-limitation requirements, payment-provider rules, and any other jurisdiction where the business operates. Keep the append-only records in the primary database for the active period, then archive encrypted exports to restricted storage rather than deleting them in place. Authentication/access logs can use a shorter 12-month active window unless an incident or local regulation requires longer retention. The application currently does not run an automatic purge; retention/archival should be an explicit infrastructure job after legal review.

## Build and run locally

```bash
docker build -t lorkulup .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e SESSION_SECRET="..." \
  -v $(pwd)/uploads-data:/app/public/uploads \
  lorkulup
```

No `--build-arg` needed — `DATABASE_URL` is runtime-only now. The `-v` volume mount is what makes uploaded images survive a container restart — omit it and they're gone on the next `docker run`.
