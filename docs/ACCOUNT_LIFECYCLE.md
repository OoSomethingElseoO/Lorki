# Account lifecycle and deletion controls

Lorki keeps one `User` identity for customers, artists, conservancy representatives,
and administrators. Account closure therefore cannot be implemented as a blind
row delete: orders, payments, payouts, reconciliation, security, and audit
records must remain explainable.

## States

`User.accountStatus` is the access-control state:

- `ACTIVE`: normal login and protected account actions are allowed.
- `DELETION_REQUESTED`: the user asked to close the account; access is disabled
  immediately while an admin reviews the request.
- `SUSPENDED`: access is disabled by an administrator or security process.
- `DELETION_APPROVED`: an admin approved closure; the account remains retained
  for the applicable financial/legal retention period and cannot log in.
- `ANONYMIZED`: eligible personal fields have been removed or replaced while
  required transaction history remains.

The state is separate from `isAdmin`, `Artist`, and `Conservancy`. Those are
capabilities attached to the same identity, not separate accounts.

## User request flow

`POST /api/account/deletion-request` requires an authenticated active user.
It creates an `AccountDeletionRequest`, changes the account to
`DELETION_REQUESTED`, increments `sessionVersion`, writes an audit event, and
clears the session cookie. Existing protected requests fail because both
`getCurrentUser(request)` and `proxy.ts` require `accountStatus = ACTIVE`.

The endpoint does not delete financial or audit records. A duplicate pending
request returns a versioned `CONFLICT` error.

## Administrator review

OPS_ADMIN or higher can inspect a user's request history with:

```text
GET /api/admin/users/:id/deletion-request
```

Review actions use:

```text
PATCH /api/admin/users/:id/deletion-request
{ "action": "APPROVE|REJECT|RESTORE|SUSPEND", "note": "..." }
```

Every action requires a permission check, is recorded in `AuditLog`, and
increments `sessionVersion`. Approval is refused while `legalHoldUntil` is in
the future. Approval disables the account; it does not physically delete the
user or its history.

## Retention and hard deletion

The schema includes `legalHoldUntil`, `anonymizedAt`, and lifecycle timestamps.
`POST /api/internal/account-retention` is the bounded, secret-protected sweep:
it processes at most 50 approved accounts per invocation, skips legal holds,
is safe to repeat, removes password history, and anonymizes identity fields
after seven years. Orders, payments, payouts, reconciliation, security,
deletion-request, and audit evidence are preserved. Configure it from an
administratively separate scheduler with `ACCOUNT_RETENTION_SECRET`; every
successful anonymization writes an audit event. Physical deletion of financial
or audit rows is deliberately not automatic. The seven-year period and exact
fields eligible for erasure must be confirmed for the applicable jurisdiction.

## Password controls

The authentication foundation hashes passwords with `scrypt`, requires a
confirmation value on signup/reset, rejects common and identity-derived
passwords, and retains the latest ten hashes to prevent immediate reuse. It
never stores plaintext passwords. Password reset should also revoke existing
sessions once the session-version wiring is complete.

## Multi-factor authentication

MFA is an optional authenticator-app factor attached to the same `User` identity;
it does not create a second account for an artist, conservancy representative,
customer, or administrator. The user opens the account action bar on the account
dashboard, chooses **Security & two-step verification**, and the security modal
walks through enrollment:

1. The server creates a short-lived setup record and an encrypted TOTP secret.
2. The modal displays the `otpauth://` URI and manual secret for an authenticator
   app. The secret is never returned after setup is confirmed.
3. The user enters a current six-digit code. The server verifies it, enables MFA,
   invalidates existing sessions, and creates eight single-use recovery codes.
4. The codes are displayed once in the modal. They are stored only as password
   hashes and cannot be recovered from the database.

The login lifecycle is:

```text
email + password
        │
        ├── MFA disabled → issue normal session cookie
        │
        └── MFA enabled → create five-minute challenge, no session yet
                               │
                               ├── authenticator code → issue session
                               └── recovery code → consume one code, issue session
```

The challenge is shown as a centered, focus-trapped modal on `/login` after the
password is accepted. Closing or expiring it does not authenticate the user;
they must start login again. Five attempts are allowed per challenge and the
endpoint is rate-limited. A successful challenge is single-use and immediately
deleted. Failed and successful MFA events are written to the audit log.

To disable MFA, an authenticated user opens the same security modal and submits
a current authenticator code. Disabling increments `sessionVersion`, removes
the encrypted secret and recovery hashes, and invalidates existing sessions.
Administrators do not bypass the user's factor through the UI; account recovery
remains a separately audited support/security process.

## MFA policy and email fallback

Operations administrators can change three policy switches from the Security tab
of `/admin/settings`:

- require MFA for administrator sign-ins;
- require MFA for configured high-risk actions such as refunds, payout release,
  offer acceptance, and settings changes;
- allow email OTP fallback.

The first switch blocks an administrator who has not enrolled until enrollment
is completed. The second switch checks the session's verified-factor marker at
the action boundary; a password-only session cannot perform the protected
operation. The policy is evaluated server-side, not by hiding or disabling a
button in the browser.

Email OTP is intentionally weaker than an authenticator because mailbox access
becomes the second factor. It is disabled by default, can be requested only from
an active five-minute MFA challenge, is rate-limited, expires after ten minutes,
is stored only as a password hash, and is audited. The email contains the code
but never the TOTP secret or recovery codes. The setting should be enabled only
after deliverability, bounce handling, provider limits, and account-recovery
ownership have been reviewed.

Administrators can send an MFA enrollment reminder from the admin user list.
Sending the reminder creates an audit event and uses the editable `mfaReminder`
email template; it does not enable MFA or alter the user's secret.

The TOTP secret is encrypted with `SETTINGS_ENCRYPTION_KEY`; keep that stable
32-byte key in the deployment secret manager. The MFA migration is
`20260926150000_add_mfa`. Before production release, verify the migration is
applied, test enrollment/login/recovery/disable flows in staging, and confirm
that authenticator secrets, recovery codes, and challenge tokens never appear
in logs or API responses after their intended step.
