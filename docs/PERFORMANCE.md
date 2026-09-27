# Lorki performance measurement and budgets

## What is measured

Lorki now collects a small, privacy-safe real-user measurement batch from the
browser. It records LCP, FCP, CLS, INP, TTFB, and long-task duration together
with the route (without query strings), a mobile/desktop class, the browser's
coarse effective connection type, and an optional release version. It does not
record IP addresses, cookies, user agents, account IDs, query parameters, page
content, or session identifiers. The rate limiter uses a one-way hash of the
source address only to bound abuse; that hash is not stored on the metric row.

The browser sends at most eight allow-listed samples per batch to
`POST /api/performance`; requests are rate-limited per source address and
malformed values are rejected. Measurements are diagnostic and must not be
used as an identity or advertising system. The `PerformanceMetric` table is
intended for rolling operational analysis; define and enforce a retention
window before enabling long-term reporting.

## Local baseline

Start the production-shaped server, then run:

```bash
npm run build
npm run start
BASE_URL="https://your-test-deployment.example" npm run performance:probe
npm run performance:budget

# Optional Lighthouse audit against the same deployment
BASE_URL="https://your-test-deployment.example" npm run performance:lighthouse
```

The Playwright probe writes `performance-report.json` and measures the mobile
home-page navigation, first-contentful paint, TTFB, resource transfer size,
and browser-observed LCP, CLS, long tasks, and interaction durations. Unsupported
browser entry types remain zero and are not treated as proof of good performance.
It is a repeatable smoke baseline, not a substitute for field RUM or a full
Lighthouse audit.

## Budgets

`performance-budget.json` is the versioned release contract:

| Metric | Budget |
| --- | ---: |
| LCP | 2,500 ms |
| FCP | 1,800 ms |
| TTFB | 800 ms |
| INP | 200 ms |
| CLS | 0.10 |
| Long tasks | 5 |
| Transfer size | 1.2 MB |

The GitHub Actions performance workflow builds the standalone app, starts it,
runs the Playwright probe, and fails when a measured value exceeds a budget.
The probe must run against a reachable server; a missing report is a failed
check rather than an implicit pass.

## Interpreting results

Use the budgets as regression gates, not as proof that every device is fast.
Compare mobile and desktop, cold and warm cache, and representative catalogue
routes. A field regression should be investigated by release, route, device
class, and connection type before changing a threshold. Keep server/API
latency separate from browser rendering latency so a backend fix is not
credited for a frontend improvement (or vice versa).
