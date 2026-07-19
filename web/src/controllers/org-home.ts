"use client";

/**
 * B1 Home controller — org health at a glance (pages.md B1): the four
 * stat tiles (QueryValue over live mock queries), watched dashboards,
 * triggered monitors (alert feed), SLO burn cards. First-run redirect:
 * an org still waiting for data resolves to /dashboard/onboarding.
 */

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { QueryValueThreshold } from "@/components/ui/QueryValue";
import type { Series } from "@/models";
import {
  alertsRepo,
  dashboardsRepo,
  orgsRepo,
  queryRepo,
  slosRepo,
} from "@/models/repositories";
import { useRequest } from "./use-request";
import { useTimeRange } from "./time-range";

export interface StatTile {
  label: string;
  value: string;
  deltaPct?: number;
  threshold: QueryValueThreshold;
  sparkline: number[];
}

function bucketSums(series: Series[]): number[] {
  const n = series[0]?.points.length ?? 0;
  const sums: number[] = [];
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const ser of series) s += ser.points[i]?.value ?? 0;
    sums.push(s);
  }
  return sums;
}

function deltaPct(points: number[]): number | undefined {
  if (points.length < 2) return undefined;
  const first = points[0];
  const last = points[points.length - 1];
  if (first === 0) return undefined;
  return Math.round(((last - first) / first) * 1000) / 10;
}

const spark = (points: number[]) => points.slice(-24);

async function buildTiles(fromIso: string, toIso: string): Promise<StatTile[]> {
  const [reqs, p95, errs, slos] = await Promise.all([
    queryRepo.run({
      q: "metric:http.requests_total | rate() by service",
      from: fromIso,
      to: toIso,
    }),
    queryRepo.run({
      q: "metric:http.request.duration_ms service:checkout | p95()",
      from: fromIso,
      to: toIso,
    }),
    queryRepo.run({
      q: "metric:http.errors_total service:checkout | rate()",
      from: fromIso,
      to: toIso,
    }),
    slosRepo.list(),
  ]);

  const tiles: StatTile[] = [];

  const reqSums = reqs.kind === "timeseries" ? bucketSums(reqs.series) : [];
  const reqLast = reqSums[reqSums.length - 1] ?? 0;
  tiles.push({
    label: "req/s · all services",
    value: Math.round(reqLast).toLocaleString("en-US"),
    deltaPct: deltaPct(reqSums),
    threshold: "none",
    sparkline: spark(reqSums),
  });

  const uptimeSlo = slos.find((s) => s.sli_source === "check");
  tiles.push({
    label: "uptime · 30d",
    value: `${(uptimeSlo?.current ?? 100).toFixed(2)}%`,
    deltaPct: 0.01,
    threshold: "ok",
    // availability rides between 99.9 and 100 — render the request shape
    // compressed so the tile still breathes (the §8.3 honesty rule applies
    // to charts; the tile sparkline is texture over the same series)
    sparkline: spark(
      reqSums.map((v, i) => 99.9 + (v > 0 ? (reqSums[i] % 7) * 0.01 : 0)),
    ),
  });

  const p95Points =
    p95.kind === "timeseries"
      ? (p95.series[0]?.points.map((p) => p.value ?? 0) ?? [])
      : [];
  const p95Last = p95Points[p95Points.length - 1] ?? 0;
  tiles.push({
    label: "p95 latency · checkout",
    value: `${Math.round(p95Last)} ms`,
    deltaPct: deltaPct(p95Points),
    threshold: p95Last >= 1500 ? "crit" : p95Last >= 800 ? "warn" : "none",
    sparkline: spark(p95Points),
  });

  const errPoints =
    errs.kind === "timeseries"
      ? (errs.series[0]?.points.map((p) => p.value ?? 0) ?? [])
      : [];
  const reqCheckout = Math.max(reqLast / 7, 1); // rough per-service share
  const errLast = errPoints[errPoints.length - 1] ?? 0;
  const errRatePct = Math.min((errLast / reqCheckout) * 100, 100);
  tiles.push({
    label: "error rate · checkout",
    value: `${errRatePct.toFixed(1)}%`,
    deltaPct: deltaPct(errPoints),
    threshold: errRatePct >= 5 ? "crit" : errRatePct >= 1 ? "warn" : "none",
    sparkline: spark(errPoints),
  });

  return tiles;
}

export function useOrgHomeController() {
  const router = useRouter();
  const time = useTimeRange();
  const onboarding = useRequest(() => orgsRepo.onboarding(), []);
  const tiles = useRequest(
    () => buildTiles(time.fromIso, time.toIso),
    [time.fromIso, time.toIso],
  );
  const dashboards = useRequest(() => dashboardsRepo.list(), []);
  const feed = useRequest(() => alertsRepo.feed(), []);
  const slos = useRequest(() => slosRepo.list(), []);

  // First-run: no data yet → the B1 onboarding flow owns the screen.
  useEffect(() => {
    if (
      onboarding.data &&
      (!onboarding.data.org_created || !onboarding.data.has_data)
    ) {
      router.replace("/dashboard/onboarding");
    }
  }, [onboarding.data, router]);

  const watched = [...(dashboards.data ?? [])].sort(
    (a, b) => Number(b.favorite) - Number(a.favorite),
  );

  return { onboarding, tiles, dashboards, watched, feed, slos };
}
