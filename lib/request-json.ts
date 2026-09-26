const MAX_JSON_BYTES = 1_048_576;

/** Read a bounded JSON object without turning malformed client input into a 500. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) return null;
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_JSON_BYTES) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}
