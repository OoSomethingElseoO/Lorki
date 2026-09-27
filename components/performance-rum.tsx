"use client";

import { useEffect } from "react";
import { PERFORMANCE_METRICS } from "@/lib/performance-metrics";

type MetricRow = { metric: string; value: number; route: string; deviceClass: string; navigationType?: string; connectionType?: string };

export function PerformanceRum() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.PerformanceObserver) return;
    const measurements = new Map<string, MetricRow>();
    const route = window.location.pathname;
    const deviceClass = window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
    const connection = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
    const common = { route, deviceClass, connectionType: connection?.effectiveType };
    const send = () => {
      const payload = Array.from(measurements.values());
      if (!payload.length) return;
      measurements.clear();
      void fetch("/api/performance", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => undefined);
    };
    const observers: PerformanceObserver[] = [];
    const observe = (type: string, callback: PerformanceObserverCallback, buffered = true) => {
      try { const observer = new PerformanceObserver(callback); observer.observe({ type, buffered }); observers.push(observer); } catch { /* browser does not support this entry type */ }
    };
    const record = (metric: MetricRow["metric"], value: number, extra: Partial<MetricRow> = {}) => {
      const previous = measurements.get(metric);
      measurements.set(metric, { metric, value: metric === "CLS" || metric === "LONG_TASK" ? (previous?.value ?? 0) + value : Math.max(previous?.value ?? 0, value), ...common, ...extra });
    };
    observe("largest-contentful-paint", (list) => { const entry = list.getEntries().at(-1); if (entry) record("LCP", entry.startTime); });
    observe("paint", (list) => { for (const entry of list.getEntries()) if (entry.name === "first-contentful-paint") record("FCP", entry.startTime); });
    observe("layout-shift", (list) => { const value = list.getEntries().reduce((sum, entry) => { const item = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }; return sum + (item.hadRecentInput ? 0 : (item.value ?? 0)); }, 0); if (value) record("CLS", value); });
    observe("event", (list) => { for (const entry of list.getEntries()) if (entry.duration) record("INP", entry.duration); }, false);
    observe("longtask", (list) => { const value = list.getEntries().reduce((sum, entry) => sum + entry.duration, 0); if (value) record("LONG_TASK", value); });
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.responseStart) record("TTFB", navigation.responseStart, { navigationType: navigation.type });
    const timer = window.setTimeout(send, 5000);
    window.addEventListener("pagehide", send);
    return () => { window.clearTimeout(timer); window.removeEventListener("pagehide", send); observers.forEach((observer) => observer.disconnect()); send(); };
  }, []);
  return null;
}

export { PERFORMANCE_METRICS };
