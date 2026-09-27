# Browser performance baselines

Lorki has a focused Playwright profile for the home page, Originals infinite
scroll, the shared artwork modal, and the rotunda carousel.

## Run it

Use the existing Playwright configuration; it starts or reuses Lorki on port
3001 and never targets QAForge's port:

```bash
npm run test:e2e -- tests/e2e/performance-baseline.spec.ts
```

To profile an already-running server:

```bash
LORKI_E2E_NO_SERVER=1 \
LORKI_E2E_BASE_URL=http://127.0.0.1:3001 \
npm run test:e2e -- tests/e2e/performance-baseline.spec.ts
```

The test attaches JSON files to the Playwright report and prints metrics with
the `[performance]` prefix. It records navigation response/DOM/load timings,
FCP, LCP when supported, cumulative layout shift, and long-task count/duration.

## Scenarios

### Routes

`/` and `/originals` are loaded with `domcontentloaded`; the test waits for a
short settling window and records browser performance entries. These are
baselines, not universal SLOs. Set `LORKI_PERF_ENFORCE=1` to enable the current
diagnostic guardrails (five-second response timing and a two-second combined
long-task budget). Tune those numbers only after collecting representative
desktop and mobile runs.

### Infinite scroll

The test scrolls the real `.infinite-scroll-sentinel`, records requests to
`/api/originals?page=N`, and compares card counts before and after settling.
The component's in-flight guard is the important correctness property: an
IntersectionObserver that remains intersecting must not create concurrent page
loads. If the feature flag is disabled or no sentinel is rendered, the test
records a skipped attachment instead of pretending it exercised the path.

### Modal and carousel

The test clicks the first real Originals card, waits for the shared dialog,
closes it with Escape, then clicks the homepage carousel's next control. It
records interaction latency and attaches JSON. Missing seeded catalogue data is
reported as a skipped scenario; populate a disposable fixture before using
these as release gates.

## Interpretation

Compare runs on the same browser, viewport, build mode, and database fixture.
Do not compare a cold dev server against a production build or infer backend
query performance from browser navigation alone. A regression should be
investigated with the trace, network log, database query timing, and a repeat
run before changing a threshold.

## Limitations

This is not Lighthouse CI and does not claim field-user Core Web Vitals. It is
an executable interaction baseline. A future production gate can add Lighthouse
against a deployed preview, mobile emulation, and a stable fixture, but those
should be separate from this local Playwright test to avoid mixing network and
database variability with UI regressions.
