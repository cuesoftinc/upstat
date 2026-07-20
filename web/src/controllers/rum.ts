"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiKeyWithSecret } from "@/models";
import { keysRepo, rumRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** RUM controller — summary, vitals, error groups (pages.md B6). */
export function useRumController(range: { from?: string; to?: string } = {}) {
  const summary = useRequest(
    () => rumRepo.summary(range),
    [range.from, range.to],
  );
  const vitals = useRequest(
    () => rumRepo.vitals(range),
    [range.from, range.to],
  );
  const errors = useRequest(() => rumRepo.errors(), []);
  const properties = useRequest(
    async () =>
      (await keysRepo.list()).filter((k) => k.kind === "property_key"),
    [],
  );
  return { summary, vitals, errors, properties };
}

/**
 * B6 drill-down controller (U6-2 [Designed 2026-07-20]) — funnel +
 * weekly-cohort retention beside the summary's sessions/top lists.
 */
export function useRumDrilldownController(
  range: { from?: string; to?: string } = {},
) {
  const summary = useRequest(
    () => rumRepo.summary(range),
    [range.from, range.to],
  );
  const drilldown = useRequest(
    () => rumRepo.drilldown(range),
    [range.from, range.to],
  );
  const properties = useRequest(
    async () =>
      (await keysRepo.list()).filter((k) => k.kind === "property_key"),
    [],
  );
  return { summary, drilldown, properties };
}

const VERIFY_TIMEOUT_MS = 10_000;

/**
 * B6 property create — domain → property-key issuance (managed in B12)
 * + browser-SDK snippet + verifying state: the pill flips green on the
 * "first pageview" (mock: a re-check resolves it, or the 10s timer —
 * the prototype's AFTER_TIMEOUT convention).
 */
export function useRumPropertyController() {
  const [created, setCreated] = useState<ApiKeyWithSecret | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const create = useCallback(async (domain: string) => {
    setCreating(true);
    setError(null);
    try {
      const key = await keysRepo.create({
        kind: "property_key",
        name: domain,
        scope: "rum",
      });
      setCreated(key);
      setVerified(false);
      return key;
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "could not create the property",
      );
      return null;
    } finally {
      setCreating(false);
    }
  }, []);

  /** "Re-check now" — the mock's first pageview has arrived by then. */
  const recheck = useCallback(() => {
    if (created) setVerified(true);
  }, [created]);

  // AFTER_TIMEOUT: the pill flips on its own if the user just waits.
  useEffect(() => {
    if (!created || verified) return;
    const t = window.setTimeout(() => setVerified(true), VERIFY_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [created, verified]);

  return { created, creating, error, verified, create, recheck };
}
