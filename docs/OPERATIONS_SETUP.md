# Operations setup guide

QAForge provides admin pages for security cases, reconciliation exceptions,
audit activity, and share analytics. It can guide and validate application
configuration, but it does not replace GitHub, AWS, Cloudflare, or Vercel
control planes.

## What admins can do in QAForge

Authenticated operations administrators can:

- Review and triage security cases at `/admin/security`.
- Review, assign, resolve, and annotate reconciliation exceptions at
  `/admin/reconciliation`.
- Search the append-only activity ledger at `/admin/activity`.
- Review sharing volume and channels at `/admin/share-analytics`.
- Manage application-level settings exposed by the admin settings page.
- Trigger or validate application operations through protected server routes.

Setup forms must submit secrets to server-side admin routes. Secret values must
never be rendered into client JavaScript, HTML, analytics events, or logs.
Prefer a managed secret store for production values; if a value is stored in the
application database, encrypt it at rest and show it only once after creation.

## What remains outside the frontend

| Control | Why it is external | Required action |
|---|---|---|
| GitHub repository secrets | They govern CI runners, not browser sessions | Add repository secrets in GitHub Actions settings |
| GitHub OIDC | Trust is configured on the cloud IAM role | Create an AWS IAM role trusted by GitHub's OIDC provider |
| S3 Object Lock | WORM retention is a bucket-level immutable property | Create the bucket with Object Lock enabled |
| Cloudflare/Vercel WAF | WAF rules sit in front of the app | Configure the provider dashboard/API and test the hostname |
| Managed secret rotation | Rotation belongs to the secret manager | Configure Doppler, Infisical, AWS Secrets Manager, or equivalent |
| DNS, TLS, and deployment domains | They are infrastructure resources | Configure them at the DNS/hosting provider |

QAForge may show setup status and links for these controls, but it must not ask
ordinary browser users for cloud root credentials or store provider access keys
in the application database.

## GitHub Actions secrets

`.github/workflows/operational-sweeps.yml` expects:

- `QAFORGE_BASE_URL`
- `RECONCILIATION_CRON_SECRET`
- `SECURITY_ALERT_CRON_SECRET`
- `AUDIT_EXPORT_SECRET`
- `AUDIT_ARCHIVE_ROLE_ARN`
- `AUDIT_ARCHIVE_AWS_REGION`
- `AUDIT_ARCHIVE_BUCKET`
- `OUTBOX_WORKER_SECRET`

Generate application secrets with:

```bash
openssl rand -base64 32
```

Never commit these values or place them in screenshots, issue comments, or
support tickets.

## AWS archive prerequisites

1. Create an S3 bucket with Object Lock enabled at creation time.
2. Configure the approved compliance retention period after legal review.
3. Create a narrowly scoped IAM role that can write only to the QAForge audit
   prefix.
4. Add the GitHub OIDC trust relationship to that role.
5. Add the role ARN, region, and bucket as GitHub secrets.
6. Run the workflow manually and verify that a locked NDJSON object appears.

Object Lock remains outside the application database so a compromised app or
database credential cannot rewrite archived audit records.

The archive workflow also writes a SHA-256 sidecar object under the same locked
prefix. Treat the NDJSON object and its sidecar as one record: download both,
verify `sha256sum -c audit.ndjson.sha256`, and record the object key and checksum
in the incident/change ticket. The export endpoint exposes a truncation header;
the workflow refuses to archive a truncated response so a 5,000-row query cap
cannot silently become a false-complete archive.

## WAF and secret-manager prerequisites

Put the deployed hostname behind the selected WAF/CDN, enable managed rules and
rate limiting, and verify that the origin is not directly reachable without the
expected host controls. Store runtime secrets in the hosting platform or a
managed secret manager, rotate them without rebuilding the image, and revoke
old values after successful deployment.

## Verification checklist

- [ ] Admin can open Security, Reconciliation, Activity, and Share Analytics.
- [ ] Unauthenticated sweep/export requests return `401`.
- [ ] GitHub Actions hourly jobs return successful JSON responses.
- [ ] The nightly job writes a locked S3 object.
- [ ] Invalid cron secrets are rejected.
- [ ] The hourly workflow drains the outbox and returns a JSON result.
- [ ] An invalid outbox secret returns `401`.
- [ ] Failed outbox delivery retries and eventually becomes `FAILED` after five attempts.
- [ ] WAF blocks a test rate-limit request while allowing normal traffic.
- [ ] Secret rotation has been tested with the old value revoked.
- [ ] Retention has been reviewed against Kenyan legal and provider obligations.

## Restore drill

Run the restore drill against a disposable Neon branch or separate PostgreSQL
instance, never the production `DATABASE_URL`:

```bash
RESTORE_DATABASE_URL="postgresql://...disposable-restore..." \
  npx prisma migrate deploy
RESTORE_DATABASE_URL="postgresql://...disposable-restore..." \
  npm run restore:drill
```

The script refuses an unspecified restore URL and refuses an exact match with
`DATABASE_URL`. It verifies connectivity, completed Prisma migrations, and the
presence/counts of critical audit, provider-event, order, and artwork tables.
The manual GitHub Actions workflow (`Restore drill`) runs the same check with a
`RESTORE_DATABASE_URL` repository secret. It does not create, mutate, or restore
production data automatically. Record the timestamp, latest migration,
row-count output, and time-to-ready after each drill.

## Notification templates

Operations administrators can edit notification subjects and bodies from
`/admin/settings` under **Notifications**. Templates support placeholders such
as `{{artworkTitle}}`, `{{amount}}`, `{{tracking}}`, `{{decision}}`, and
`{{siteName}}`. Values are HTML-escaped before rendering. Missing or malformed
templates fall back to the built-in defaults. Provider credentials still use
the admin-settings-over-environment fallback and are encrypted at rest when
`SETTINGS_ENCRYPTION_KEY` is configured.
