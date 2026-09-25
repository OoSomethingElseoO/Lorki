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
- [ ] WAF blocks a test rate-limit request while allowing normal traffic.
- [ ] Secret rotation has been tested with the old value revoked.
- [ ] Retention has been reviewed against Kenyan legal and provider obligations.
