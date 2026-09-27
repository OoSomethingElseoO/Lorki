import { test, expect, type Page } from "@playwright/test";

type BrowserMetrics = {
  url: string;
  navigation: { domContentLoaded: number; load: number; response: number };
  paint: { fcp: number | null; lcp: number | null };
  cls: number;
  longTasks: number;
  longTaskMs: number;
};

async function measurePage(page: Page, path: string): Promise<BrowserMetrics> {
  await page.addInitScript(() => {
    (window as typeof window & { __lorkiPerf?: { longTasks: number[]; lcp: number | null; cls: number } }).__lorkiPerf = {
      longTasks: [],
      lcp: null,
      cls: 0,
    };
    if ("PerformanceObserver" in window) {
      try {
        new PerformanceObserver((list) => {
          const state = (window as typeof window & { __lorkiPerf: { longTasks: number[] } }).__lorkiPerf;
          for (const entry of list.getEntries()) state.longTasks.push(entry.duration);
        }).observe({ type: "longtask", buffered: true });
        new PerformanceObserver((list) => {
          const state = (window as typeof window & { __lorkiPerf: { lcp: number | null } }).__lorkiPerf;
          const last = list.getEntries().at(-1);
          if (last) state.lcp = last.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          const state = (window as typeof window & { __lorkiPerf: { cls: number } }).__lorkiPerf;
          for (const entry of list.getEntries() as PerformanceEntry[]) {
            const value = (entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }).value ?? 0;
            if (!(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput) state.cls += value;
          }
        }).observe({ type: "layout-shift", buffered: true });
      } catch {
        // Metrics are best effort on browsers that do not expose these entries.
      }
    }
  });
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(750);
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType("paint");
    const state = (window as typeof window & { __lorkiPerf?: { longTasks: number[]; lcp: number | null; cls: number } }).__lorkiPerf;
    return {
      url: location.href,
      navigation: {
        domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
        load: navigation?.loadEventEnd ?? 0,
        response: navigation?.responseEnd ?? 0,
      },
      paint: {
        fcp: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? null,
        lcp: state?.lcp ?? null,
      },
      cls: state?.cls ?? 0,
      longTasks: state?.longTasks.length ?? 0,
      longTaskMs: state?.longTasks.reduce((sum, duration) => sum + duration, 0) ?? 0,
    } satisfies BrowserMetrics;
  });
  expect(response?.ok(), `Expected ${path} to return HTTP success`).toBeTruthy();
  await test.info().attach(`performance-${path.replace(/[^a-z0-9]+/gi, "-")}.json`, {
    body: JSON.stringify(metrics, null, 2),
    contentType: "application/json",
  });
  return metrics;
}

function report(name: string, value: unknown) {
  console.log(`[performance] ${name} ${JSON.stringify(value)}`);
}

test.describe("Lorki performance baselines", () => {
  test("home and originals route baseline", async ({ page }) => {
    const home = await measurePage(page, "/");
    const originals = await measurePage(page, "/originals");
    report("routes", { home, originals });
    // These are diagnostic guardrails, not production SLOs. Set
    // LORKI_PERF_ENFORCE=1 in CI to turn them into release gates.
    if (process.env.LORKI_PERF_ENFORCE === "1") {
      expect(home.navigation.response).toBeLessThan(5_000);
      expect(originals.navigation.response).toBeLessThan(5_000);
      expect(home.longTaskMs + originals.longTaskMs).toBeLessThan(2_000);
    }
  });

  test("infinite-scroll load profile does not issue concurrent page loads", async ({ page }) => {
    const requests: string[] = [];
    let activePageLoads = 0;
    let maxConcurrentPageLoads = 0;
    page.on("request", (request) => {
      if (request.url().includes("/api/originals?page=")) {
        requests.push(request.url());
        activePageLoads += 1;
        maxConcurrentPageLoads = Math.max(maxConcurrentPageLoads, activePageLoads);
      }
    });
    page.on("requestfinished", (request) => {
      if (request.url().includes("/api/originals?page=")) activePageLoads = Math.max(0, activePageLoads - 1);
    });
    page.on("requestfailed", (request) => {
      if (request.url().includes("/api/originals?page=")) activePageLoads = Math.max(0, activePageLoads - 1);
    });
    await page.goto("/originals", { waitUntil: "domcontentloaded" });
    const initialCards = await page.locator(".layout-grid__card").count();
    const sentinel = page.locator(".infinite-scroll-sentinel");
    if (!(await sentinel.count())) {
      await test.info().attach("infinite-scroll-skipped.txt", { body: "Infinite scroll is disabled or no sentinel was rendered." });
      return;
    }
    await sentinel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1_500);
    const afterFirstLoad = await page.locator(".layout-grid__card").count();
    await page.waitForTimeout(500);
    const afterSettled = await page.locator(".layout-grid__card").count();
    report("infinite-scroll", { initialCards, afterFirstLoad, afterSettled, requests, maxConcurrentPageLoads });
    expect(maxConcurrentPageLoads).toBeLessThanOrEqual(1);
    expect(afterSettled).toBeGreaterThanOrEqual(initialCards);
  });

  test("modal and carousel interaction profile", async ({ page }) => {
    await page.goto("/originals", { waitUntil: "domcontentloaded" });
    const card = page.locator(".layout-grid__card").first();
    if (await card.count()) {
      const start = Date.now();
      await card.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      const openMs = Date.now() - start;
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toBeHidden();
      report("modal", { openMs });
      await test.info().attach("modal-interaction.json", { body: JSON.stringify({ openMs }, null, 2), contentType: "application/json" });
    }

    await page.goto("/", { waitUntil: "domcontentloaded" });
    const carousel = page.locator(".rotunda-gallery").first();
    const next = page.getByRole("button", { name: /show next artwork/i }).first();
    if (!(await carousel.count()) || !(await next.count())) {
      await test.info().attach("carousel-skipped.txt", { body: "No carousel controls rendered for this fixture." });
      return;
    }
    const start = Date.now();
    await next.click();
    await page.waitForTimeout(650);
    const interactionMs = Date.now() - start;
    report("carousel", { interactionMs });
    await test.info().attach("carousel-interaction.json", { body: JSON.stringify({ interactionMs }, null, 2), contentType: "application/json" });
  });
});
