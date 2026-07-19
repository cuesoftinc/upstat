"use client";

/**
 * B5 service map controller — nodes from the APM service stats, edges from
 * the seeded call topology (the ingest path the hero trace walks). Edge
 * tooltips carry throughput/error/latency (design.md §3 ServiceMapNode).
 */

import { useMemo } from "react";
import type { ServiceStats } from "@/models";
import { useServicesController } from "./telemetry";

/** Seeded call topology (matches the seed narrative + hero trace). */
export const SERVICE_EDGES: [string, string][] = [
  ["web", "api-common"],
  ["checkout", "api-common"],
  ["status-page", "api-common"],
  ["api-common", "clickhouse"],
  ["api-common", "worker"],
  ["ingest-gw", "clickhouse"],
  ["worker", "clickhouse"],
];

export interface MapNode {
  stats: ServiceStats;
  /** Layout position, fractions of the canvas (0..1). */
  x: number;
  y: number;
}

export interface MapEdge {
  from: string;
  to: string;
  reqPerS: number;
  errorRate: number;
  p95Ms: number;
  erroring: boolean;
}

/**
 * Deterministic radial layout — api-common (the hub) centers, the rest
 * ring around it. (Bespoke SVG per the reuse policy; layout math is ours.)
 */
function layoutNodes(services: ServiceStats[]): MapNode[] {
  const hub = "api-common";
  const ring = services.filter((s) => s.service !== hub);
  return services.map((s) => {
    if (s.service === hub) return { stats: s, x: 0.5, y: 0.44 };
    const i = ring.findIndex((r) => r.service === s.service);
    const angle = (i / Math.max(ring.length, 1)) * 2 * Math.PI - Math.PI / 2;
    return {
      stats: s,
      x: 0.5 + 0.38 * Math.cos(angle),
      y: 0.44 + 0.36 * Math.sin(angle),
    };
  });
}

export function useServiceMapController() {
  const services = useServicesController();

  const { nodes, edges } = useMemo(() => {
    const list = services.data ?? [];
    const byName = new Map(list.map((s) => [s.service, s]));
    const nodes = layoutNodes(list);
    const edges: MapEdge[] = SERVICE_EDGES.filter(
      ([a, b]) => byName.has(a) && byName.has(b),
    ).map(([from, to]) => {
      const dest = byName.get(to)!;
      const src = byName.get(from)!;
      return {
        from,
        to,
        reqPerS: Math.round(Math.min(src.req_per_s, dest.req_per_s) * 10) / 10,
        errorRate: dest.error_rate,
        p95Ms: dest.p95_ms,
        erroring: dest.error_rate >= 0.05,
      };
    });
    return { nodes, edges };
  }, [services.data]);

  return { services, nodes, edges };
}

/** Dependencies of one service (both directions), for the B5 detail page. */
export function serviceDependencies(service: string): string[] {
  const deps = new Set<string>();
  for (const [from, to] of SERVICE_EDGES) {
    if (from === service) deps.add(to);
    if (to === service) deps.add(from);
  }
  return [...deps];
}
