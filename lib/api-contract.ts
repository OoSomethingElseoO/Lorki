import { NextResponse } from "next/server";

/**
 * Version of the public JSON response contract. Keep this independent from
 * the application version so clients can safely negotiate API changes.
 */
export const API_CONTRACT_VERSION = "1";

export function apiJson<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-api-contract-version", API_CONTRACT_VERSION);
  return NextResponse.json(body, { ...init, headers });
}

/** Stable error envelope for routes that opt into the contract. */
export function apiContractError(
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
) {
  return apiJson(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}
