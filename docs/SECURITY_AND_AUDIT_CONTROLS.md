# Security and audit controls

## Security threshold monitoring

`runSecurityAlertSweep` evaluates recent audit and reconciliation activity for:

- Refund spikes.
- Payout overrides.
- Admin access revocations.
- Critical unresolved reconciliation cases.
- Provider events with no local order.

Signals are deduplicated for the sweep window and can open a `SecurityCase`.
The case stores a fingerprint, severity, evidence, status, assignee, triage
note, and resolution note.

## Admin triage

`/admin/security` lists open cases and allows authorized administrators to move
them through investigation and resolution. Every triage or resolution action
is written to the append-only audit ledger.

## Audit ledger

The shared `recordAudit` helper is used by admin and artist mutation routes.
Database protection prevents normal application updates and deletes to audit
rows. Entity type and ID fields make actions traceable to orders, payouts,
users, offers, reconciliation cases, and settings.

The ledger is tamper-resistant against application-level changes, not a claim
that a person with unrestricted database-owner credentials cannot rewrite the
database. External archival provides the stronger boundary.

## External archive

`GET /api/internal/audit/export` emits audit and provider events as NDJSON.
It requires a separate export secret. The scheduled workflow writes the export
to an S3 Object-Lock compliance bucket through GitHub OIDC.

## Incident boundary

The application can detect, record, alert, and expose evidence. It cannot
protect itself from a compromised cloud account by itself. WAF rules, secret
rotation, IAM isolation, provider revocation, backups, and incident response
remain external operational controls documented in `OPERATIONS_SETUP.md`.
