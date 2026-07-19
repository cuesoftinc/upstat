"use client";

import { useCallback, useState } from "react";
import { catalogRepo, queryRepo, tracesRepo } from "@/models/repositories";
import type { ServiceCatalogEntry } from "@/models";
import { useRequest } from "./use-request";
import { useTimeRange } from "./time-range";

/** Service catalog controller (pages.md B11). */
export function useCatalogController() {
  const state = useRequest(() => catalogRepo.list(), []);

  const create = useCallback(
    async (input: Omit<ServiceCatalogEntry, "id">) => {
      await catalogRepo.create(input);
      await state.reload();
    },
    [state],
  );

  const update = useCallback(
    async (id: string, patch: Partial<ServiceCatalogEntry>) => {
      await catalogRepo.update(id, patch);
      await state.reload();
    },
    [state],
  );

  return { ...state, create, update };
}

/**
 * B11 catalog page controller — searchable registry + the selected-service
 * detail rail (req/s, p95, error-rate tiles fed by the query surface).
 */
export function useCatalogPageController() {
  const catalog = useCatalogController();
  const services = useRequest(() => tracesRepo.services(), []);
  const time = useTimeRange();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const entries = (catalog.data ?? []).filter((e) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return (
      e.name.toLowerCase().includes(needle) ||
      e.owner.toLowerCase().includes(needle) ||
      e.environments.some((env) => env.toLowerCase().includes(needle))
    );
  });

  const selected =
    (catalog.data ?? []).find((e) => e.id === selectedId) ?? entries[0] ?? null;

  const detail = useRequest(async () => {
    if (!selected) return null;
    const [reqs, p95, errs] = await Promise.all([
      queryRepo.run({ q: `metric:http.requests_total service:${selected.name} | rate()`, from: time.fromIso, to: time.toIso }),
      queryRepo.run({ q: `metric:http.request.duration_ms service:${selected.name} | p95()`, from: time.fromIso, to: time.toIso }),
      queryRepo.run({ q: `metric:http.errors_total service:${selected.name} | rate()`, from: time.fromIso, to: time.toIso }),
    ]);
    const spark = (r: typeof reqs) =>
      r.kind === "timeseries" ? (r.series[0]?.points ?? []).map((p) => p.value ?? 0).slice(-24) : [];
    return { reqs: spark(reqs), p95: spark(p95), errs: spark(errs) };
  }, [selected?.name, time.fromIso, time.toIso]);

  const stats = (services.data ?? []).find((s) => s.service === selected?.name) ?? null;

  return { catalog, entries, search, setSearch, selected, select: setSelectedId, detail, stats };
}
