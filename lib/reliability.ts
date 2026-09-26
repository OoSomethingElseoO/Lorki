export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private failures = 0;
  private openedAt = 0;
  private state: CircuitState = "CLOSED";
  private halfOpenProbeInFlight = false;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly shouldTrip: (error: unknown) => boolean = () => true,
  ) {}

  getState(now = Date.now()): CircuitState {
    if (this.state === "OPEN" && now - this.openedAt >= this.cooldownMs) this.state = "HALF_OPEN";
    return this.state;
  }

  async run<T>(operation: () => Promise<T>, now = Date.now()): Promise<T> {
    const state = this.getState(now);
    if (state === "OPEN") throw new Error("DEPENDENCY_CIRCUIT_OPEN");
    if (state === "HALF_OPEN") {
      if (this.halfOpenProbeInFlight) throw new Error("DEPENDENCY_CIRCUIT_OPEN");
      this.halfOpenProbeInFlight = true;
    }
    try {
      const result = await operation();
      this.failures = 0;
      this.state = "CLOSED";
      return result;
    } catch (error) {
      if (this.shouldTrip(error) || state === "HALF_OPEN") this.failures += 1;
      if (this.failures >= this.threshold || state === "HALF_OPEN") {
        this.state = "OPEN";
        this.openedAt = Date.now();
      }
      throw error;
    } finally {
      if (state === "HALF_OPEN") this.halfOpenProbeInFlight = false;
    }
  }
}

/** An HTTP failure that preserves the provider status for retry/breaker policy. */
export class ExternalServiceError extends Error {
  readonly status: number;

  constructor(service: string, status: number, details = "") {
    super(`${service} responded ${status}${details ? `: ${details}` : ""}`);
    this.name = "ExternalServiceError";
    this.status = status;
  }
}

export function isRetryableDatabaseError(error: unknown): boolean {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code) : "";
  return code === "P2034" || code === "40P01" || code === "40001" || /deadlock|serialization|connection.*pool|unable to start a transaction|transaction.*timeout|etimedout|timeout/i.test(String(error));
}

export async function withDatabaseRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableDatabaseError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt + Math.floor(Math.random() * 25)));
    }
  }
  throw lastError;
}

/**
 * Retry only transient external failures. Callers must provide an idempotent
 * operation (or a provider idempotency key); this helper must never be used
 * to blindly repeat a money movement or email send.
 */
export function isRetryableExternalError(error: unknown): boolean {
  const status = typeof error === "object" && error && "status" in error
    ? Number((error as { status?: unknown }).status)
    : 0;
  return status === 408 || status === 425 || status === 429 || status >= 500
    || /timeout|timed out|econnreset|eai_again|socket|network|fetch failed/i.test(String(error));
}

export async function withExternalRetry<T>(
  operation: () => Promise<T>,
  options: { attempts?: number; baseDelayMs?: number; shouldRetry?: (error: unknown) => boolean } = {},
): Promise<T> {
  const attempts = Math.max(1, Math.min(options.attempts ?? 2, 3));
  const baseDelayMs = Math.max(5, Math.min(options.baseDelayMs ?? 50, 1_000));
  const shouldRetry = options.shouldRetry ?? isRetryableExternalError;
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
