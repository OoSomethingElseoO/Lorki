export const SHARE_TARGETS = ["artwork", "artist", "campaign"] as const;
export const SHARE_CHANNELS = ["native", "clipboard", "unknown"] as const;

export type ShareTargetType = (typeof SHARE_TARGETS)[number];
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type ShareEventInput = {
  targetType: ShareTargetType;
  targetId: string;
  channel: ShareChannel;
};

export function parseShareEventInput(body: unknown): ShareEventInput | null {
  if (!body || typeof body !== "object") return null;
  const input = body as { targetType?: unknown; targetId?: unknown; channel?: unknown };
  if (
    typeof input.targetType !== "string" ||
    !SHARE_TARGETS.includes(input.targetType as ShareTargetType) ||
    typeof input.targetId !== "string" ||
    input.targetId.length < 1 ||
    input.targetId.length > 128
  ) return null;

  const channel = typeof input.channel === "string" && SHARE_CHANNELS.includes(input.channel as ShareChannel)
    ? input.channel as ShareChannel
    : "unknown";
  return { targetType: input.targetType as ShareTargetType, targetId: input.targetId, channel };
}
