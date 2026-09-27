export const PERFORMANCE_METRICS = ["LCP", "FCP", "CLS", "INP", "TTFB", "LONG_TASK"] as const;
export type PerformanceMetricName = (typeof PERFORMANCE_METRICS)[number];

const allowed = new Set<string>(PERFORMANCE_METRICS);

export function isPerformanceMetricName(value: unknown): value is PerformanceMetricName {
  return typeof value === "string" && allowed.has(value);
}

export function safePerformanceRoute(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 160) return null;
  // Do not persist query strings, fragments, or control characters.
  const route = value.split(/[?#]/, 1)[0];
  return route && /^[\/a-zA-Z0-9._~!$&'()*+,;=:@% -]+$/.test(route) ? route : null;
}

export function normalizePerformanceBatch(input: unknown) {
  if (!Array.isArray(input) || input.length === 0 || input.length > 8) return null;
  const rows = input.map((item) => {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const value = typeof row.value === "number" ? row.value : Number(row.value);
    const route = safePerformanceRoute(row.route);
    if (!isPerformanceMetricName(row.metric) || !Number.isFinite(value) || value < 0 || value > 300_000 || !route) return null;
    const deviceClass = row.deviceClass === "mobile" || row.deviceClass === "desktop" ? row.deviceClass : "unknown";
    const navigationType = typeof row.navigationType === "string" && row.navigationType.length <= 24 ? row.navigationType : null;
    const connectionType = typeof row.connectionType === "string" && /^[a-z0-9_-]{1,24}$/i.test(row.connectionType) ? row.connectionType : null;
    return { metric: row.metric, value, route, deviceClass, navigationType, connectionType };
  });
  return rows.every(Boolean) ? rows as Array<{ metric: PerformanceMetricName; value: number; route: string; deviceClass: string; navigationType: string | null; connectionType: string | null }> : null;
}
