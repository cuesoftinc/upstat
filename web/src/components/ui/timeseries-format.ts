import type { Series } from "@/models";

export function seriesColor(i: number): string {
  return `var(--color-series-${(i % 8) + 1})`;
}

export function formatValue(v: number, unit?: string): string {
  const compact =
    Math.abs(v) >= 1000
      ? `${(v / 1000).toFixed(1)}k`
      : // ≥100 the fractional digit is axis noise ("520 ms", not "520.2 ms")
        Math.abs(v) >= 100
        ? String(Math.round(v))
        : v % 1 === 0
          ? String(v)
          : v.toFixed(1);
  // unit suffix per the master ladder — the zero tick stays bare "0"
  return unit && v !== 0 ? `${compact} ${unit}` : compact;
}

/**
 * True when the query/series' OUTER aggregation is a count-type fn — `count()`
 * (row/point count) or `uniq()` (the grammar's count-distinct, query-
 * grammar.md §4 function table). Those return a unitless number no matter
 * what the aggregated metric is named, so `count(http.request.duration_ms)`
 * must not sniff "ms" off the field just because it contains `_ms`. Series
 * names and query strings both lead with the fn (`Series.name` is
 * `fn(field) tags…`; the query string's aggregation clause follows `|`), so
 * matching at the start of either or right after a `|` catches the OUTER fn
 * without tripping on an inner field name.
 */
const OUTER_COUNT_AGG = /(?:^|\|\s*)(?:count|count_distinct|uniq)\s*\(/i;

/** Unit sniff for the default: seeded metric names carry `*_ms`. */
export function deriveUnit(
  series: Series[],
  query?: string,
): string | undefined {
  if (
    OUTER_COUNT_AGG.test(series[0]?.name ?? "") ||
    OUTER_COUNT_AGG.test(query ?? "")
  ) {
    return undefined;
  }
  const haystack = `${series[0]?.name ?? ""} ${query ?? ""}`;
  return /_ms\b/.test(haystack) ? "ms" : undefined;
}

export function formatTime(ts: string): string {
  // hh:mm in UTC — bucketing renders UTC per X-10.
  return ts.slice(11, 16);
}

export function formatTimeSeconds(ts: string): string {
  // hh:mm:ss for the crosshair tooltip header (master 50:407: "14:32:00").
  return ts.slice(11, 19);
}

/**
 * Legend label — the DISTINGUISHING part of a series name. Grouped query
 * names ("p95(http.request.duration_ms) service:api-common") all share the
 * fn(metric) prefix; truncating from the right rendered eight identical
 * legend entries (system-QA finding 2026-07-19). Prefer the tag suffix;
 * the full name stays on the title tooltip.
 */
export function legendLabel(name: string): string {
  const idx = name.indexOf(") ");
  if (idx === -1) return name;
  // The master's label idiom keeps only the tag VALUES ("api-common", not
  // "service:api-common") — for by-<tag> groups the key is shared by every
  // entry, so it distinguishes nothing (adjudicated 2026-07-20).
  return name
    .slice(idx + 2)
    .split(/\s+/)
    .map((pair) => {
      const colon = pair.indexOf(":");
      return colon === -1 ? pair : pair.slice(colon + 1);
    })
    .join(" ");
}
