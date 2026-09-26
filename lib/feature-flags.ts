/**
 * Small, deterministic feature-flag boundary for server and client callers.
 * Existing production capabilities default on so adding this layer cannot
 * silently disable auctions, analytics, or payouts. Operators can explicitly
 * disable a capability with FEATURE_NAME=false; unknown flag names remain off.
 */
const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const DEFAULTS: Record<FeatureFlag, boolean> = {
  AUCTIONS: true,
  AUTOMATIC_PAYOUTS: true,
  SHARE_ANALYTICS: true,
  ORIGINALS_INFINITE_SCROLL: true,
};

export type FeatureFlag =
  | "AUCTIONS"
  | "AUTOMATIC_PAYOUTS"
  | "SHARE_ANALYTICS"
  | "ORIGINALS_INFINITE_SCROLL";

export function isFeatureEnabled(flag: FeatureFlag, env: Record<string, string | undefined> = process.env): boolean {
  const value = env[`FEATURE_${flag}`];
  if (typeof value !== "string") return DEFAULTS[flag];
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return DEFAULTS[flag];
}

export function featureFlags(env: Record<string, string | undefined> = process.env): Record<FeatureFlag, boolean> {
  return {
    AUCTIONS: isFeatureEnabled("AUCTIONS", env),
    AUTOMATIC_PAYOUTS: isFeatureEnabled("AUTOMATIC_PAYOUTS", env),
    SHARE_ANALYTICS: isFeatureEnabled("SHARE_ANALYTICS", env),
    ORIGINALS_INFINITE_SCROLL: isFeatureEnabled("ORIGINALS_INFINITE_SCROLL", env),
  };
}
