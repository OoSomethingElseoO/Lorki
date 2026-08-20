// In-memory sliding-window limiter. Fine for a single self-hosted server —
// like the local-disk image uploads, this resets on redeploy and doesn't
// share state across instances, so swap it for a Redis-backed limiter before
// running multiple instances behind a load balancer.
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

  if (timestamps.length >= maxHits) {
    hits.set(key, timestamps);
    return true;
  }

  timestamps.push(now);
  hits.set(key, timestamps);
  return false;
}

export function getRequestIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
