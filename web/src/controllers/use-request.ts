"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/models";

export interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
  /** Re-runs the fetch (controllers call this after mutations). */
  reload: () => Promise<void>;
}

/**
 * Shared async-load primitive for controllers. Views never fetch — they
 * consume controller state built on this. `deps` re-triggers the load when
 * its (serialized) value changes.
 */
export function useRequest<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
): RequestState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const seq = useRef(0);

  // Latest fetcher without re-creating the callback per render
  // (ref updated in an effect — no ref writes during render).
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const depsKey = JSON.stringify(deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (seq.current === id) setData(result);
    } catch (e) {
      if (seq.current === id) setError(e as Error);
    } finally {
      if (seq.current === id) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Deferred a tick: keeps setState out of the synchronous effect body
    // (no cascading renders) and guarantees fnRef is current.
    const t = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(t);
    // depsKey re-runs the load when the caller's inputs change
  }, [reload, depsKey]);

  return { data, loading, error, reload };
}
