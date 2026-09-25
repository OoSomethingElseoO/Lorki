export const SECURITY_CASE_STATUSES = ["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED", "FALSE_POSITIVE"] as const;
export const SECURITY_CASE_SEVERITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

export type SecurityCaseUpdate = {
  status?: (typeof SECURITY_CASE_STATUSES)[number];
  severity?: (typeof SECURITY_CASE_SEVERITIES)[number];
  assignedTo?: string | null;
  triageNote?: string;
  resolutionNote?: string | null;
};

export function parseSecurityCaseUpdate(body: unknown): SecurityCaseUpdate | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  if (
    (input.status !== undefined && (typeof input.status !== "string" || !SECURITY_CASE_STATUSES.includes(input.status as (typeof SECURITY_CASE_STATUSES)[number]))) ||
    (input.severity !== undefined && (typeof input.severity !== "string" || !SECURITY_CASE_SEVERITIES.includes(input.severity as (typeof SECURITY_CASE_SEVERITIES)[number])))
  ) return null;

  const result: SecurityCaseUpdate = {};
  if (input.status !== undefined) result.status = input.status as SecurityCaseUpdate["status"];
  if (input.severity !== undefined) result.severity = input.severity as SecurityCaseUpdate["severity"];
  if (input.assignedTo !== undefined) {
    if (typeof input.assignedTo !== "string") return null;
    result.assignedTo = input.assignedTo.trim() || null;
  }
  if (input.triageNote !== undefined) {
    if (typeof input.triageNote !== "string") return null;
    result.triageNote = input.triageNote.trim();
  }
  if (input.resolutionNote !== undefined) {
    if (input.resolutionNote !== null && typeof input.resolutionNote !== "string") return null;
    result.resolutionNote = typeof input.resolutionNote === "string" ? input.resolutionNote.trim() : null;
  }
  return result;
}
