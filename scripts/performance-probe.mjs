import fs from "node:fs";
import { chromium } from "@playwright/test";

const baseUrl = process.env.BASE_URL;
if (!baseUrl) throw new Error("BASE_URL is required; pass the deployed or test server URL explicitly");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
const resources = [];
page.on("response", (response) => resources.push(response));
await page.addInitScript(() => {
  const state = { lcpMs: 0, cls: 0, longTasks: 0, longTaskMs: 0, inpMs: 0 };
  window.__lorkiPerf = state;
  try {
    new PerformanceObserver((list) => {
      const last = list.getEntries().at(-1);
      if (last) state.lcpMs = last.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) state.cls += entry.value ?? 0;
      }
    }).observe({ type: "layout-shift", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        state.longTasks += 1;
        state.longTaskMs += entry.duration;
      }
    }).observe({ type: "longtask", buffered: true });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) state.inpMs = Math.max(state.inpMs, entry.duration);
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  } catch {
    // Unsupported entry types remain explicitly zero rather than being inferred.
  }
});
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 30_000 });
const metrics = await page.evaluate(async () => {
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const nav = performance.getEntriesByType("navigation")[0];
  const paints = performance.getEntriesByType("paint");
  const observed = window.__lorkiPerf ?? { lcpMs: 0, cls: 0, longTasks: 0, longTaskMs: 0, inpMs: 0 };
  return { ttfbMs: nav?.responseStart ?? 0, fcpMs: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime ?? 0, ...observed };
});
const transferBytes = resources.reduce((sum, response) => sum + Number(response.headers()["content-length"] ?? 0), 0);
const report = { ...metrics, transferBytes };
fs.writeFileSync(process.env.PERFORMANCE_REPORT ?? "performance-report.json", JSON.stringify(report, null, 2));
await browser.close();
console.log(JSON.stringify(report));
