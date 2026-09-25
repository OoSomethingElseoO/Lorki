# Reconciliation operations

## Purpose

Reconciliation compares provider events and settlement exports with local
orders. It is designed to expose missing records, amount differences, currency
differences, duplicate events, refunds, and late provider updates.

## Records

- `PaymentProviderEvent` preserves provider identity, event type, payload,
  processing state, and receipt time.
- `PaymentReconciliation` stores the comparison result, expected/observed
  amounts, currency, priority, assignee, triage note, and resolution metadata.
- `AuditLog` records imports, decisions, resolutions, and administrative
  actions.

## Matching rules

`MATCHED` requires a local order in the expected paid state and matching amount
and currency. Refunds or disputes that make the local order no longer paid are
not treated as successfully matched. Unknown provider events become
`MISSING_LOCAL_ORDER`; amount or currency differences become mismatch cases.

The import path is idempotent for provider, external ID, and event type. Input
rows are validated before persistence and capped to protect the endpoint from
oversized batches.

## Jobs and UI

- `POST /api/internal/reconciliation/sweep` checks a rolling window of paid
  orders and creates missing-comparison cases.
- `POST /api/admin/reconciliation/import` imports a normalized settlement file
  for a finance administrator.
- `/admin/reconciliation` supports provider/status/priority filters,
  pagination, assignment, triage notes, and resolution.

The GitHub Actions workflow runs the sweep hourly. Provider settlement imports
remain an explicit finance operation because each provider has a different
export/API format.

## Retention

Financial records are retained in the database during the active period and
archived to external immutable storage. The default seven-year period is an
operational placeholder and must be reviewed against Kenyan law, provider
rules, and the jurisdictions where the business operates.
