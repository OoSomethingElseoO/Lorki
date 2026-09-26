export type InboxStatus = "RECEIVED" | "PROCESSED" | "FAILED";

/** Duplicate delivery policy shared by provider webhook routes. */
export function shouldReprocessInboxEvent(status: InboxStatus | undefined): boolean {
  return status === "FAILED";
}

export function shouldIgnoreDuplicateInboxEvent(status: InboxStatus | undefined): boolean {
  return status === "PROCESSED" || status === "RECEIVED" || status === undefined;
}
