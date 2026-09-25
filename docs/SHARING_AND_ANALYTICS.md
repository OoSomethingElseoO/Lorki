# Sharing and analytics

## Share events

The shared `ShareButton` sends a rate-limited event after a successful native
share or clipboard action. Events identify only the supported public target
type (`artwork`, `artist`, or `campaign`), target ID, channel, timestamp, and
optional authenticated user ID. Unsupported target types and oversized IDs are
rejected.

The event endpoint is `POST /api/share-events`. It does not accept arbitrary
database entity names or private target records.

## Admin analytics

`GET /api/admin/share-analytics` is permission-protected and supports date,
target type, channel, search, and pagination filters. `/admin/share-analytics`
shows totals, authenticated versus anonymous sharing, and the underlying event
rows for authorized staff.

## Privacy and retention

The event model intentionally stores minimal attribution. It should not be
expanded to capture message contents, address-book data, or private share
payloads. Retention and deletion rules must be reviewed alongside the site's
privacy policy and Kenyan data-protection obligations.
