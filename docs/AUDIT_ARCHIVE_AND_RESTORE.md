# Audit archive and restore verification

The application database is not the immutable archive. The intended archive is
an S3-compatible bucket created with Object Lock in compliance mode. GitHub
Actions uses OIDC and a narrowly scoped role to write audit NDJSON exports;
application/database credentials must not be able to rewrite locked objects.

Each export includes a count/truncation signal. The archive job refuses
truncated responses and writes a SHA-256 sidecar beside the NDJSON object.
During review, download both files and run:

```bash
sha256sum -c audit.ndjson.sha256
```

Required GitHub secrets include the archive bucket, region, role ARN, and
`AUDIT_EXPORT_SECRET`. Configure these only after legal review of retention
period and Kenyan data-protection requirements.

## Restore drill

`npm run restore:drill` requires `RESTORE_DATABASE_URL`. It refuses an unset
URL or one equal to production `DATABASE_URL`, checks connectivity, confirms
Prisma migrations, and verifies critical audit, provider-event, order, and
artwork tables. The manual `.github/workflows/restore-drill.yml` runs the same
check against a disposable restore database.

```bash
RESTORE_DATABASE_URL="postgresql://disposable-branch..." \
  npx prisma migrate deploy
RESTORE_DATABASE_URL="postgresql://disposable-branch..." \
  npm run restore:drill
```

Record migration version, row counts, restore timestamp, and time-to-ready.
The workflow does not create or mutate production data. The actual Object Lock
bucket, GitHub secrets, and a real restore run remain deployment-owner actions,
not claims that can be proven from source code alone.
