/**
 * B12 usage metering (pages.md B12 [Designed 2026-07-20], OBS-012) — the
 * month-to-date meters are COMPUTED from the seeded telemetry volumes
 * (accuracy canon: honest numbers, not invented):
 *
 * - metrics  → Σ cardinality over the seeded metrics catalog (B3 summary)
 * - logs     → 3 lines/s (the B4 generator's rate) × seconds MTD × the
 *              measured average line size of real generated lines
 * - traces   → the APM services' req/s series integrated hourly over the
 *              month × the seeded traces' mean span count
 * - rum      → the B6 summary's page-view math over [month start, now]
 *
 * Bars scale each meter against its trailing-3-month peak (design.md
 * §8.2b UsageMeterRow) — for the seeded narrative that peak is the
 * busiest full month the generators describe.
 */

import type { UsageMeter, UsageReport } from "@/models";
import type { MockDb } from "./seed";
import { SERVICES, metricValue } from "./series";
import { logLinesAtSecond } from "./series";
import { rumSummary } from "./rum-data";
import { DAY, HOUR, SECOND } from "./util";

/** Verbatim plan column (accuracy canon — no invented quotas/pricing). */
export const USAGE_PLAN_COPY = "Self-host: unlimited · Cloud: announced at GA";

const LOG_LINES_PER_SECOND = 3; // the B4 generator's fixed rate

/** Timezone offset (ms) of `tz` at instant `tMs`. */
function tzOffsetMs(tMs: number, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf.formatToParts(tMs).map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour) % 24,
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(tMs / SECOND) * SECOND;
}

/** Month boundaries resolve in the ORG timezone (X-10); storage stays UTC. */
export function monthStartMs(now: number, tz: string): number {
  const offset = tzOffsetMs(now, tz);
  const local = new Date(now + offset);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offset;
}

export function monthLabel(now: number, tz: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    month: "long",
    year: "numeric",
  }).format(now);
}

/** Measured mean byte size of real generated lines (JSON-serialized). */
export function averageLogLineBytes(db: MockDb, now: number): number {
  const sampleSeconds = 200;
  let bytes = 0;
  let lines = 0;
  const startSec = Math.floor(now / SECOND) - sampleSeconds;
  for (let sec = startSec; sec < startSec + sampleSeconds; sec++) {
    for (const event of logLinesAtSecond(sec, db.outage)) {
      bytes += JSON.stringify(event).length;
      lines += 1;
    }
  }
  return lines === 0 ? 0 : bytes / lines;
}

/** Mean span count across the seeded trace explorer list. */
function meanSpanCount(db: MockDb): number {
  if (db.traceSummaries.length === 0) return 0;
  return (
    db.traceSummaries.reduce((s, t) => s + t.span_count, 0) /
    db.traceSummaries.length
  );
}

/** Requests/s integrated hourly over [fromMs, toMs), all services. */
function integratedRequests(db: MockDb, fromMs: number, toMs: number): number {
  let total = 0;
  for (const service of SERVICES) {
    for (let t = fromMs; t < toMs; t += HOUR) {
      const sliceMs = Math.min(HOUR, toMs - t);
      total +=
        metricValue("http.requests_total", "rate", service, t, db.outage) *
        (sliceMs / SECOND);
    }
  }
  return total;
}

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

function fmtGb(bytes: number): string {
  const gb = bytes / 1e9;
  return `${gb >= 10 ? Math.round(gb) : gb.toFixed(2)} GB`;
}

/**
 * The four pillar meters. `peak` = the busiest full month the generators
 * describe (trailing-3-month peak, §8.2b): for rate-driven pillars that is
 * a 31-day integration of the same math; for the active-series gauge the
 * catalog's cardinality is the peak (it has no month shape).
 */
export function buildUsageReport(db: MockDb, now: number): UsageReport {
  const tz = db.org.timezone || "UTC";
  const from = monthStartMs(now, tz);
  const mtdSeconds = Math.max(0, Math.floor((now - from) / SECOND));

  // metrics — active series (gauge; Σ catalog cardinality)
  const activeSeries = db.metricCatalog.reduce((s, m) => s + m.cardinality, 0);

  // logs — bytes ingested MTD
  const avgLineBytes = averageLogLineBytes(db, now);
  const logBytes = LOG_LINES_PER_SECOND * mtdSeconds * avgLineBytes;
  const logBytesFullMonth =
    LOG_LINES_PER_SECOND * 31 * (DAY / SECOND) * avgLineBytes;

  // traces — spans MTD
  const spansPerTrace = meanSpanCount(db);
  const spans = integratedRequests(db, from, now) * spansPerTrace;
  const spansFullMonth =
    integratedRequests(db, now - 31 * DAY, now) * spansPerTrace;

  // rum — events MTD (the B6 summary's own page-view math)
  const rumEvents = rumSummary(from, now).page_views;
  const rumFullMonth = rumSummary(now - 31 * DAY, now).page_views;

  const rows: UsageMeter[] = [
    {
      pillar: "metrics",
      label: "Metrics — active series",
      value: Math.round(activeSeries),
      display: fmtCount(activeSeries),
      peak: Math.round(activeSeries),
      plan: USAGE_PLAN_COPY,
    },
    {
      pillar: "logs",
      label: "Logs — ingested",
      value: Math.round(logBytes),
      display: fmtGb(logBytes),
      peak: Math.round(logBytesFullMonth),
      plan: USAGE_PLAN_COPY,
    },
    {
      pillar: "traces",
      label: "Traces — spans",
      value: Math.round(spans),
      display: fmtCount(spans),
      peak: Math.round(spansFullMonth),
      plan: USAGE_PLAN_COPY,
    },
    {
      pillar: "rum",
      label: "RUM — events",
      value: Math.round(rumEvents),
      display: fmtCount(rumEvents),
      peak: Math.round(rumFullMonth),
      plan: USAGE_PLAN_COPY,
    },
  ];

  return { month_label: monthLabel(now, tz), rows };
}
