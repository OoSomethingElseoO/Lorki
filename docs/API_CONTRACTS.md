# API contracts and error handling

Lorki exposes a versioned JSON contract for routes that have been migrated.
The implementation lives in `lib/api-contract.ts`.

## Success envelope

`apiJson(body, init)` preserves the route's response body and adds:

```http
x-api-contract-version: 1
content-type: application/json
```

The body is intentionally not wrapped in a second `data` property, so existing
clients can adopt the header without a breaking payload change.

## Error envelope

Errors returned by `apiContractError` have this shape:

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "artworkId is required",
    "details": { "field": "artworkId" }
  }
}
```

`details` is optional and must not contain secrets, tokens, raw provider
payloads, or stack traces. Error codes are for machines; messages are for
humans. HTTP status remains authoritative for generic clients.

## Current migration coverage

The contract is used by login, signup, uploads, originals, inquiries,
checkout, offers, feature discovery, idempotency responses, reconciliation
and the high-risk admin/payment routes. `lib/permissions.ts` and
`lib/prisma-errors.ts` use the same error builder.

The migration is intentionally incremental. Before changing a remaining legacy
route, identify its callers and preserve any documented payload fields. Do not
convert a route by wrapping its body blindly if a client currently expects a
different status or field name.

## Client handling

Clients should:

1. Check `response.ok`.
2. Parse the error envelope defensively.
3. Branch on `error.code` for recoverable cases such as `RATE_LIMITED`,
   `ARTWORK_UNAVAILABLE`, `FEATURE_DISABLED`, or `APPROVAL_REQUIRED`.
4. Display `error.message` only as user-facing text after sanitization.
5. Treat unknown codes as a generic temporary failure.

## Verification

```bash
npx tsx --test lib/__tests__/api-contract.test.ts
npx tsx --test lib/__tests__/authorization.test.ts
```

For a live route:

```bash
curl -i http://127.0.0.1:3001/api/originals?page=0
```

Confirm the response includes `x-api-contract-version: 1`, and test an invalid
request to confirm the machine-readable `error.code` is present. Contract
headers do not prove authorization; authentication and ownership must still be
tested separately.

## Compatibility rules

- Increment the contract version only for an incompatible payload/status
  change.
- Add fields before removing fields.
- Keep error codes stable once published.
- Never expose Prisma/provider error strings directly.
- Document route-specific pagination, caching, and authentication behavior
  alongside the route.
