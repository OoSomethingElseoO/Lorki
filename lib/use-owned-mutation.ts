"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MutationOwner } from "@/lib/owned-mutation-core";

export type OwnedMutationState = {

  pending: boolean;
  error: string | null;
};

export type MutationResult<T> =
  | { applied: true; value: T }
  | { applied: true; error: string }
  | { applied: false; stale: true };

/**
 * Owns one client mutation at a time.
 *
 * The caller may apply a reversible optimistic change before the request is
 * sent. A failed current request invokes rollback; an old request is simply
 * discarded and cannot overwrite newer UI. AbortController is an optimisation
 * only—the generation check is the correctness boundary because a server may
 * continue after the browser aborts.
 */
export function useOwnedMutation() {
  const owner = useRef<MutationOwner | null>(null);
  if (!owner.current) owner.current = new MutationOwner();
  const [state, setState] = useState<OwnedMutationState>({ pending: false, error: null });

  const cancel = useCallback(() => {
    owner.current!.cancel();
    setState({ pending: false, error: null });
  }, []);

  const run = useCallback(async <T,>(
    operation: (signal: AbortSignal) => Promise<T>,
    options: { optimistic?: () => void; rollback?: () => void } = {},
  ): Promise<MutationResult<T>> => {
    const { generation, signal } = owner.current!.begin();
    options.optimistic?.();
    setState({ pending: true, error: null });
    try {
      const value = await operation(signal);
      if (!owner.current!.isCurrent(generation)) return { applied: false, stale: true };
      setState({ pending: false, error: null });
      return { applied: true, value };
    } catch (cause) {
      if (!owner.current!.isCurrent(generation)) return { applied: false, stale: true };
      options.rollback?.();
      const message = cause instanceof Error ? cause.message : "Mutation failed";
      setState({ pending: false, error: message });
      return { applied: true, error: message };
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return { ...state, run, cancel };
}
