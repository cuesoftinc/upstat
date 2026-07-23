/**
 * Seed narrative — the Figma mock story, exactly: org "Upstat" in
 * Africa/Lagos; services api-common/web/worker/ingest-gw/clickhouse/
 * status-page/checkout; the INC-42 SEV-1 (MONITORING) checkout incident;
 * the POST /v1/events hero trace (9f86d081…, 6 spans); roster
 * Ibukun/Kemi/Tola/Sade.
 */

import type {
  AlertChannel,
  AlertEvent,
  AlertRule,
  ApiKey,
  Dashboard,
  ErrorGroup,
  Incident,
  Member,
  MetricSummary,
  Monitor,
  Org,
  Postmortem,
  SavedView,
  ServiceCatalogEntry,
  Slo,
  StatusPageConfig,
  SyntheticCheck,
  SyntheticRun,
  TimelineEntry,
  Trace,
  TraceSummary,
} from "@/models";
import { DAY, HOUR, MINUTE, SECOND, iso } from "@/lib/format";
import { hashSeed, mulberry32 } from "@/lib/random";
import { nextId } from "./util";
import { SERVICES, type OutageWindow } from "./series";
import { seedSynthetics } from "./synthetics";

export const HERO_TRACE_ID = "9f86d081884c7d659a2feaa0c55ad015";

export interface MockDb {
  seededAt: number;
  outage: OutageWindow;
  org: Org;
  onboarding: { org_created: boolean; has_data: boolean; ingest_key: string };
  /**
   * Fresh-org first-datapoint ETA (ms epoch) — the mock resolves the
   * waiting-for-data state to populated on a timer, mirroring the
   * prototype's AFTER_TIMEOUT convention (web-implementation.md §6).
   * `null` on the primary seed (data was always flowing).
   */
  firstDataAtMs: number | null;
  /** Public status-page slug (pages.md B7 — owner-chosen, unique). */
  statusSlug: string | null;
  /**
   * Status-page builder document (B7 [Designed 2026-07-20]) — branding +
   * ordered component list; `buildStatusPage` renders it. Null until the
   * org publishes a page. `statusSlug` mirrors `statusPage.slug` (the
   * routing key the public read resolves).
   */
  statusPage: StatusPageConfig | null;
  members: Member[];
  dashboards: Dashboard[];
  monitors: Monitor[];
  synthetics: SyntheticCheck[];
  /** Run history per synthetic check id, newest first. */
  syntheticRuns: Record<string, SyntheticRun[]>;
  channels: AlertChannel[];
  rules: AlertRule[];
  alertFeed: AlertEvent[];
  incidents: Incident[];
  timelines: Record<string, TimelineEntry[]>;
  /** B9 postmortems by incident id (backs `postmortem_key`). */
  postmortems: Record<string, Postmortem>;
  slos: Slo[];
  catalog: ServiceCatalogEntry[];
  keys: ApiKey[];
  views: SavedView[];
  metricCatalog: MetricSummary[];
  heroTrace: Trace | null;
  traceSummaries: TraceSummary[];
  errorGroups: ErrorGroup[];
}

export function buildSeed(now: number): MockDb {
  // INC-42: checkout 5xx spike — declared 3h ago, mitigated 2h15m ago, MONITORING.
  const inc42Start = now - 3 * HOUR;
  const inc42End = now - 2 * HOUR - 15 * MINUTE;
  const outage: OutageWindow = {
    start: inc42Start,
    end: inc42End,
    services: ["checkout", "api-common"],
  };

  const org: Org = {
    id: "org_upstat",
    name: "Upstat",
    timezone: "Africa/Lagos",
    created_at: iso(now - 120 * DAY),
  };

  const members: Member[] = [
    {
      id: "usr_ibukun",
      name: "Ibukun",
      email: "ibukun@cuesoft.io",
      role: "owner",
      status: "active",
    },
    {
      id: "usr_kemi",
      name: "Kemi",
      email: "kemi@cuesoft.io",
      role: "admin",
      status: "active",
    },
    {
      id: "usr_tola",
      name: "Tola",
      email: "tola@cuesoft.io",
      role: "member",
      status: "active",
    },
    {
      id: "usr_sade",
      name: "Sade",
      email: "sade@cuesoft.io",
      role: "member",
      status: "invited",
    },
  ];

  const dashboards: Dashboard[] = [
    {
      id: "dash_overview",
      org_id: org.id,
      name: "Service overview",
      favorite: true,
      shared: true,
      template_vars: { env: ["prod", "staging"], service: [...SERVICES] },
      updated_at: iso(now - 2 * DAY),
      widgets: [
        {
          id: "wid_p95",
          dashboard_id: "dash_overview",
          type: "timeseries",
          title: "p95 latency by service",
          query: null,
          query_string: "metric:http.request.duration_ms | p95() by service",
          viz_options: { display: "line" },
          // h4: the 7-service legend needs the extra row to render unclipped
          layout: { x: 0, y: 0, w: 8, h: 4 },
        },
        {
          id: "wid_reqs",
          dashboard_id: "dash_overview",
          type: "query_value",
          title: "Requests /s",
          query: null,
          // $service: the template-var bar must govern at least the seeded
          // widgets — an all-static seed made the picker a dead control
          // (system-QA finding 2026-07-19)
          query_string: "metric:http.requests_total service:$service | rate()",
          viz_options: { precision: 0, sparkline: true },
          layout: { x: 8, y: 0, w: 4, h: 4 },
        },
        {
          id: "wid_err_rate",
          dashboard_id: "dash_overview",
          type: "timeseries",
          title: "Error rate — $service",
          query: null,
          query_string:
            "metric:http.errors_total service:$service env:$env | rate()",
          viz_options: { display: "area" },
          // second timeseries widget: makes the MI-2 cross-widget crosshair
          // sync observable on the seeded dashboard
          layout: { x: 0, y: 7, w: 12, h: 2 },
        },
        {
          id: "wid_top",
          dashboard_id: "dash_overview",
          type: "toplist",
          title: "Top services by errors",
          query: null,
          query_string: "metric:http.errors_total | sum() by service",
          viz_options: { limit: 5 },
          layout: { x: 0, y: 4, w: 6, h: 3 },
        },
        {
          id: "wid_logs",
          dashboard_id: "dash_overview",
          type: "logstream",
          title: "Error logs",
          query: null,
          query_string: "level:ERROR",
          viz_options: {},
          layout: { x: 6, y: 4, w: 6, h: 3 },
        },
      ],
    },
    {
      id: "dash_checkout",
      org_id: org.id,
      name: "Checkout health",
      favorite: false,
      shared: true,
      template_vars: { env: ["prod"] },
      updated_at: iso(now - 90 * MINUTE),
      widgets: [
        {
          id: "wid_ck_err",
          dashboard_id: "dash_checkout",
          type: "timeseries",
          title: "checkout error rate",
          query: null,
          query_string: "metric:http.errors_total service:checkout | rate()",
          viz_options: { display: "bars" },
          layout: { x: 0, y: 0, w: 6, h: 3 },
        },
        {
          id: "wid_ck_p95",
          dashboard_id: "dash_checkout",
          type: "timeseries",
          title: "checkout p95",
          query: null,
          query_string:
            "metric:http.request.duration_ms service:checkout | p95()",
          viz_options: { display: "area" },
          layout: { x: 6, y: 0, w: 6, h: 3 },
        },
        {
          id: "wid_ck_slo",
          dashboard_id: "dash_checkout",
          type: "slo",
          title: "Checkout latency SLO",
          query: null,
          viz_options: { slo_id: "slo_checkout" },
          layout: { x: 0, y: 3, w: 4, h: 2 },
        },
      ],
    },
    {
      id: "dash_rum",
      org_id: org.id,
      name: "RUM overview",
      favorite: false,
      shared: false,
      template_vars: {},
      updated_at: iso(now - 6 * DAY),
      widgets: [],
    },
  ];

  const monitors: Monitor[] = [
    {
      id: "mon_homepage",
      name: "Homepage",
      target: "https://upstat.cuesoft.io",
      type: "website",
      active: true,
      status: "up",
      muted: false,
      interval_seconds: 60,
      timeout_seconds: 10,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: iso(now - 40 * 1000),
      last_response_time_ms: 142,
      last_status_code: 200,
      created_at: iso(now - 110 * DAY),
      updated_at: iso(now - 40 * 1000),
    },
    {
      id: "mon_api",
      name: "API health",
      target: "https://api.upstat.cuesoft.io/health",
      type: "api",
      active: true,
      status: "up",
      muted: false,
      interval_seconds: 30,
      timeout_seconds: 5,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: iso(now - 12 * 1000),
      last_response_time_ms: 88,
      last_status_code: 200,
      created_at: iso(now - 110 * DAY),
      updated_at: iso(now - 12 * 1000),
    },
    {
      id: "mon_status",
      name: "Status page",
      target: "https://status.upstat.cuesoft.io/upstat",
      type: "website",
      active: true,
      status: "up",
      muted: false,
      interval_seconds: 60,
      timeout_seconds: 10,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: iso(now - 25 * 1000),
      last_response_time_ms: 201,
      last_status_code: 200,
      created_at: iso(now - 96 * DAY),
      updated_at: iso(now - 25 * 1000),
    },
    {
      id: "mon_checkout",
      name: "Checkout flow",
      target: "https://checkout.cuesoft.io/health",
      type: "api",
      active: true,
      status: "up", // recovered — INC-42 is MONITORING
      muted: false,
      interval_seconds: 30,
      timeout_seconds: 5,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: iso(now - 8 * 1000),
      last_response_time_ms: 460,
      last_status_code: 200,
      created_at: iso(now - 80 * DAY),
      updated_at: iso(now - 8 * 1000),
    },
    {
      id: "mon_blog",
      name: "Legacy blog",
      target: "https://blog.cuesoft.io",
      type: "blog",
      active: false,
      status: "paused",
      muted: true,
      interval_seconds: 300,
      timeout_seconds: 10,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: iso(now - 21 * DAY),
      last_response_time_ms: null,
      last_status_code: null,
      created_at: iso(now - 100 * DAY),
      updated_at: iso(now - 21 * DAY),
    },
    {
      id: "mon_docs",
      name: "Docs",
      target: "https://cuesoft.gitbook.io/upstat",
      type: "website",
      active: true,
      status: "pending",
      muted: false,
      interval_seconds: 60,
      timeout_seconds: 10,
      failure_threshold: 3,
      consecutive_failures: 0,
      last_checked_at: null,
      last_response_time_ms: null,
      last_status_code: null,
      created_at: iso(now - 10 * MINUTE),
      updated_at: iso(now - 10 * MINUTE),
    },
  ];

  // friendly names lead the AlertChannelCard per the master anatomy
  const channels: AlertChannel[] = [
    {
      id: "ch_email",
      kind: "email",
      name: "On-call email",
      target: "ops@cuesoft.io",
      health: "verified",
      created_at: iso(now - 100 * DAY),
    },
    {
      id: "ch_slack",
      kind: "webhook",
      name: "Slack #incidents webhook",
      target: "https://hooks.slack.com/services/T0UPSTAT/B0ALERTS/xxxx",
      health: "verified",
      created_at: iso(now - 90 * DAY),
    },
    {
      id: "ch_pager",
      kind: "webhook",
      name: "Ops pager webhook",
      target: "https://ops.cuesoft.io/hooks/upstat",
      health: "unverified",
      created_at: iso(now - 2 * DAY),
    },
  ];

  const rules: AlertRule[] = [
    {
      id: "rule_checkout_p95",
      org_id: org.id,
      name: "Checkout p95 latency",
      signal: "metric",
      query: {
        v: 1,
        filters: {
          op: "and",
          terms: [
            { facet: "metric", cmp: "eq", value: "http.request.duration_ms" },
            { facet: "service", cmp: "eq", value: "checkout" },
          ],
        },
        agg: [{ fn: "p95", field: "http.request.duration_ms" }],
        step: "auto",
      },
      query_string: "metric:http.request.duration_ms service:checkout | p95()",
      thresholds: { warn: 800, crit: 1500, window: "5m" },
      notify: {
        channel_ids: ["ch_email", "ch_slack"],
        cooldown_minutes: 10,
        renotify_minutes: 30,
        mute_windows: [],
      },
      state: "alert",
      last_triggered_at: iso(inc42Start),
    },
    {
      id: "rule_error_logs",
      org_id: org.id,
      name: "Error log spike (checkout)",
      signal: "log",
      query: {
        v: 1,
        filters: {
          op: "and",
          terms: [
            { facet: "service", cmp: "eq", value: "checkout" },
            { facet: "level", cmp: "eq", value: "ERROR" },
          ],
        },
        agg: [{ fn: "count" }],
        step: "auto",
      },
      query_string: "service:checkout level:ERROR | count()",
      thresholds: { warn: 50, crit: 100, window: "5m" },
      notify: {
        channel_ids: ["ch_slack"],
        cooldown_minutes: 10,
        renotify_minutes: 0,
        mute_windows: [],
      },
      state: "warn",
      last_triggered_at: iso(inc42Start + 4 * MINUTE),
    },
    {
      id: "rule_homepage_uptime",
      org_id: org.id,
      name: "Homepage down",
      signal: "uptime",
      query: {
        v: 1,
        filters: {
          op: "and",
          terms: [{ facet: "check", cmp: "eq", value: "homepage" }],
        },
        agg: [{ fn: "rate" }],
        step: "auto",
      },
      query_string: "check:homepage | rate()",
      thresholds: { warn: null, crit: 1, window: "3 checks" },
      notify: {
        channel_ids: ["ch_email", "ch_slack"],
        cooldown_minutes: 5,
        renotify_minutes: 15,
        // weekend maintenance mute (the rule-editor recurrence shape) —
        // seeds the B8 grouped view's Muted bucket
        mute_windows: [{ from: "SAT 00:00", to: "MON 00:00" }],
      },
      state: "ok",
      last_triggered_at: iso(now - 23 * DAY),
    },
    {
      id: "rule_slo_burn",
      org_id: org.id,
      name: "Checkout SLO fast burn",
      signal: "slo_burn",
      query: {
        v: 1,
        filters: {
          op: "and",
          terms: [{ facet: "service", cmp: "eq", value: "checkout" }],
        },
        agg: [{ fn: "rate" }],
        step: "auto",
      },
      query_string: "slo:checkout-latency | burn_rate()",
      thresholds: { warn: 6, crit: 14.4, window: "2h" },
      notify: {
        channel_ids: ["ch_email"],
        cooldown_minutes: 60,
        renotify_minutes: 0,
        mute_windows: [],
      },
      state: "warn",
      last_triggered_at: iso(inc42Start + 12 * MINUTE),
    },
    {
      id: "rule_trace_latency",
      org_id: org.id,
      name: "Ingest gateway trace latency",
      signal: "trace",
      query: {
        v: 1,
        filters: {
          op: "and",
          terms: [
            { facet: "service", cmp: "eq", value: "ingest-gw" },
            { facet: "trace.duration_ms", cmp: "gt", value: 250 },
          ],
        },
        agg: [{ fn: "p95", field: "trace.duration_ms" }],
        step: "auto",
      },
      query_string:
        "service:ingest-gw trace.duration_ms:>250 | p95(trace.duration_ms)",
      thresholds: { warn: 400, crit: 900, window: "10m" },
      notify: {
        channel_ids: ["ch_slack"],
        cooldown_minutes: 15,
        renotify_minutes: 0,
        mute_windows: [],
      },
      state: "ok",
      // fired + recovered 4d ago — matches the evt_5/evt_6 feed pair
      last_triggered_at: iso(now - 4 * DAY),
    },
  ];

  // every non-ok rule state has a matching feed event, and each rule's
  // newest event matches its `last_triggered_at` (realism fix 2026-07-19:
  // rule_slo_burn sat in `warn` with no feed entry)
  const alertFeed: AlertEvent[] = [
    {
      id: "evt_1",
      ts: iso(inc42Start),
      sev: "sev1",
      rule_id: "rule_checkout_p95",
      monitor_name: "Checkout p95 latency",
      message: "p95 2,412 ms breached crit 1,500 ms (window 5m)",
      unread: true,
    },
    {
      id: "evt_2",
      ts: iso(inc42Start + 4 * MINUTE),
      sev: "sev2",
      rule_id: "rule_error_logs",
      monitor_name: "Error log spike (checkout)",
      message: "132 ERROR lines in 5m (warn 50)",
      unread: false,
    },
    {
      id: "evt_4",
      ts: iso(inc42Start + 12 * MINUTE),
      sev: "sev2",
      rule_id: "rule_slo_burn",
      monitor_name: "Checkout SLO fast burn",
      message: "burn rate 6.2x over warn 6x (window 2h)",
      unread: false,
    },
    {
      id: "evt_5",
      ts: iso(now - 4 * DAY + 25 * MINUTE),
      sev: "resolved",
      rule_id: "rule_trace_latency",
      monitor_name: "Ingest gateway trace latency",
      message: "Recovered after 25m — p95 back under 400 ms",
      unread: false,
    },
    {
      id: "evt_6",
      ts: iso(now - 4 * DAY),
      sev: "sev2",
      rule_id: "rule_trace_latency",
      monitor_name: "Ingest gateway trace latency",
      message: "p95 612 ms breached warn 400 ms (window 10m)",
      unread: false,
    },
    {
      id: "evt_3",
      ts: iso(now - 23 * DAY),
      sev: "resolved",
      rule_id: "rule_homepage_uptime",
      monitor_name: "Homepage down",
      message: "Recovered after 6m — all checks passing",
      unread: false,
    },
  ];

  const incidents: Incident[] = [
    {
      id: "inc_42",
      org_id: org.id,
      key: "INC-42",
      title: "Checkout 5xx spike — ingest retry storm saturating ClickHouse",
      sev: 1,
      status: "monitoring",
      roles: { commander: "Ibukun", responders: ["Kemi", "Tola"] },
      started_at: iso(inc42Start),
      resolved_at: null,
      postmortem_key: null,
      services: ["checkout", "api-common"],
    },
    {
      id: "inc_41",
      org_id: org.id,
      key: "INC-41",
      title: "Homepage brief outage — CDN config rollout",
      sev: 3,
      status: "resolved",
      roles: { commander: "Kemi", responders: ["Sade"] },
      started_at: iso(now - 23 * DAY),
      resolved_at: iso(now - 23 * DAY + 22 * MINUTE),
      postmortem_key: "upstat/postmortems/org_upstat/inc_41.md",
      services: ["web"],
    },
  ];

  const timelines: Record<string, TimelineEntry[]> = {
    inc_42: [
      {
        id: "tl_1",
        incident_id: "inc_42",
        ts: iso(inc42Start),
        author: "Ibukun",
        phase: "investigating",
        body: "Declared SEV-1. Checkout error rate at 22%, p95 2.4 s. Paging checkout + platform on-call.",
      },
      {
        id: "tl_2",
        incident_id: "inc_42",
        ts: iso(inc42Start + 20 * MINUTE),
        author: "Kemi",
        phase: "identified",
        body: "Root cause identified: ingest-gw retry storm saturating the ClickHouse insert queue; checkout writes time out downstream. Applying throttle to ingest-gw retries.",
      },
      {
        id: "tl_3",
        incident_id: "inc_42",
        ts: iso(inc42End),
        author: "Ibukun",
        phase: "monitoring",
        body: "/status monitoring — throttle in place, error rate back under 0.5% and p95 recovering. Watching for regression before resolve.",
      },
    ],
    inc_41: [
      {
        id: "tl_4",
        incident_id: "inc_41",
        ts: iso(now - 23 * DAY),
        author: "Kemi",
        phase: "investigating",
        body: "Homepage returning 522 through the CDN after config rollout.",
      },
      {
        id: "tl_5",
        incident_id: "inc_41",
        ts: iso(now - 23 * DAY + 22 * MINUTE),
        author: "Kemi",
        phase: "resolved",
        body: "Rolled back CDN config; all checks green for 15m. Postmortem attached.",
      },
    ],
  };

  // INC-41's attached postmortem (its `postmortem_key` above) — the B9
  // template shape: sections + the timeline frozen at composition time.
  const postmortems: Record<string, Postmortem> = {
    inc_41: {
      incident_id: "inc_41",
      title: "INC-41 — Homepage brief outage — CDN config rollout",
      author: "Kemi",
      created_at: iso(now - 23 * DAY + 2 * HOUR),
      updated_at: iso(now - 23 * DAY + 2 * HOUR),
      impact:
        "Homepage served 522s through the CDN for 22 minutes. The public status page showed a partial outage on web; no data loss and no other service was affected. Uptime checks recorded the full window as down-minutes.",
      root_cause:
        "A CDN configuration rollout switched the origin-shield route to a decommissioned origin pool. The rollout's health check validated against the old pool, so the canary passed while live traffic 522'd.",
      action_items: [
        "Gate CDN config rollouts on origin-pool liveness, not the legacy health check",
        "Alert on edge 5xx rate independently of origin checks",
        "Write down the CDN rollback runbook used ad hoc during the incident",
      ],
      timeline: (timelines.inc_41 ?? []).map((entry) => ({
        ts: entry.ts,
        phase: entry.phase,
        author: entry.author,
        body: entry.body,
      })),
    },
  };

  const slos: Slo[] = [
    {
      id: "slo_api",
      org_id: org.id,
      name: "API availability",
      sli_source: "check",
      target: 99.9,
      window: "30d",
      current: 99.97,
      budget_remaining_pct: 82,
      burn_rate: 0.4,
      state: "healthy",
    },
    {
      id: "slo_checkout",
      org_id: org.id,
      name: "Checkout p95 < 800 ms",
      sli_source: "latency",
      target: 99.0,
      window: "30d",
      current: 98.91,
      budget_remaining_pct: 11,
      burn_rate: 6.2,
      state: "burning",
    },
    {
      id: "slo_ingest",
      org_id: org.id,
      name: "Ingest freshness",
      sli_source: "metric_ratio",
      target: 99.5,
      window: "30d",
      current: 99.08,
      budget_remaining_pct: 0,
      burn_rate: 2.8,
      state: "exhausted",
      exhausted_at: iso(now - 3 * DAY),
    },
  ];

  const owners = ["Ibukun", "Kemi", "Tola", "Sade"];
  const catalog: ServiceCatalogEntry[] = SERVICES.map((name, i) => ({
    id: `svc_${name}`,
    name,
    owner: owners[i % owners.length],
    links: {
      repo: `https://github.com/cuesoftinc/upstat`,
      ...(name === "checkout" || name === "ingest-gw"
        ? { runbook: "https://cuesoft.gitbook.io/upstat" }
        : {}),
    },
    environments: name === "status-page" ? ["prod"] : ["prod", "staging"],
    telemetry: {
      metrics: true,
      logs: name !== "status-page",
      traces: !["clickhouse", "status-page"].includes(name),
      rum: ["web", "status-page", "checkout"].includes(name),
    },
  }));

  const keys: ApiKey[] = [
    {
      id: "key_prod_otlp",
      kind: "ingestion_token",
      name: "Production OTLP",
      scope: "otlp",
      key_masked: "uk_live_3f2a…c91d",
      status: "active",
      created_at: iso(now - 100 * DAY),
      rejected_count: 12,
    },
    {
      id: "key_rum_upstat",
      kind: "property_key",
      name: "upstat.cuesoft.io",
      scope: "rum",
      key_masked: "pk_live_9b41…77e2",
      status: "active",
      created_at: iso(now - 96 * DAY),
      rejected_count: 431,
    },
    {
      id: "key_staging",
      kind: "ingestion_token",
      name: "Staging (all signals)",
      scope: "all",
      key_masked: "uk_test_51ac…0b3f",
      status: "rotation_grace",
      created_at: iso(now - 30 * DAY),
      rejected_count: 0,
    },
    {
      id: "key_old_collector",
      kind: "ingestion_token",
      name: "Old collector",
      scope: "otlp",
      key_masked: "uk_live_77d0…12aa",
      status: "revoked",
      created_at: iso(now - 200 * DAY),
      rejected_count: 3,
    },
  ];

  const metricCatalog: MetricSummary[] = [
    {
      name: "http.request.duration_ms",
      type: "distribution",
      unit: "ms",
      cardinality: 1240,
      ingestion_rate_per_s: 3400,
      last_seen: iso(now - 5_000),
      tags: ["service", "env", "path", "status"],
    },
    {
      name: "http.requests_total",
      type: "count",
      cardinality: 860,
      ingestion_rate_per_s: 3400,
      last_seen: iso(now - 5_000),
      tags: ["service", "env", "path", "status"],
    },
    {
      name: "http.errors_total",
      type: "count",
      cardinality: 412,
      ingestion_rate_per_s: 60,
      last_seen: iso(now - 9_000),
      tags: ["service", "env", "status"],
    },
    {
      name: "process.cpu.percent",
      type: "gauge",
      unit: "%",
      cardinality: 42,
      ingestion_rate_per_s: 14,
      last_seen: iso(now - 10_000),
      tags: ["service", "host"],
    },
    {
      name: "process.memory.rss_bytes",
      type: "gauge",
      unit: "bytes",
      cardinality: 42,
      ingestion_rate_per_s: 14,
      last_seen: iso(now - 10_000),
      tags: ["service", "host"],
    },
    {
      name: "clickhouse.insert.duration_ms",
      type: "distribution",
      unit: "ms",
      cardinality: 96,
      ingestion_rate_per_s: 210,
      last_seen: iso(now - 4_000),
      tags: ["table", "host"],
    },
    {
      name: "ingest.events.accepted_total",
      type: "count",
      cardinality: 28,
      ingestion_rate_per_s: 950,
      last_seen: iso(now - 3_000),
      tags: ["property", "signal"],
    },
    {
      name: "queue.depth",
      type: "gauge",
      cardinality: 18,
      ingestion_rate_per_s: 7,
      last_seen: iso(now - 6_000),
      tags: ["service", "queue"],
    },
  ];

  // The hero trace: POST /v1/events through the ingest path — 6 spans.
  const traceStart = now - 42 * MINUTE;
  const heroTrace: Trace = {
    trace_id: HERO_TRACE_ID,
    root_service: "api-common",
    root_name: "POST /v1/events",
    start: iso(traceStart),
    duration_ms: 48.2,
    span_count: 6,
    status: "ok",
    spans: [
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_root",
        parent_id: null,
        service: "api-common",
        name: "POST /v1/events",
        start: iso(traceStart),
        duration_ns: 48_200_000,
        status: "ok",
        attrs: {
          "http.method": "POST",
          "http.route": "/v1/events",
          "http.status_code": "202",
          batch_size: "48",
        },
      },
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_auth",
        parent_id: "span_root",
        service: "api-common",
        name: "auth.verify_property_key",
        start: iso(traceStart + 1),
        duration_ns: 2_900_000,
        status: "ok",
        attrs: {
          property: "pk_live_9b41…77e2",
          origin: "https://upstat.cuesoft.io",
        },
      },
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_validate",
        parent_id: "span_root",
        service: "api-common",
        name: "events.validate_batch",
        start: iso(traceStart + 5),
        duration_ns: 4_600_000,
        status: "ok",
        attrs: { accepted: "47", rejected: "1", rejection_code: "unknown_dim" },
      },
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_hash",
        parent_id: "span_root",
        service: "api-common",
        name: "visitor.hash",
        start: iso(traceStart + 10),
        duration_ns: 800_000,
        status: "ok",
        attrs: { salt_day: iso(now).slice(0, 10) },
      },
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_insert",
        parent_id: "span_root",
        service: "clickhouse",
        name: "clickhouse.insert",
        start: iso(traceStart + 12),
        duration_ns: 22_400_000,
        status: "ok",
        attrs: { table: "events", rows: "47" },
      },
      {
        trace_id: HERO_TRACE_ID,
        span_id: "span_enqueue",
        parent_id: "span_root",
        service: "worker",
        name: "rollup.enqueue",
        start: iso(traceStart + 36),
        duration_ns: 4_100_000,
        status: "ok",
        attrs: { queue: "rollup-hourly", depth: "38" },
      },
    ],
  };

  // Deterministic explorer list around the hero trace.
  const traceSummaries: TraceSummary[] = [heroTraceSummary(heroTrace)];
  const endpoints: [string, string][] = [
    ["api-common", "GET /v1/stats"],
    ["api-common", "POST /v1/query"],
    ["web", "GET /"],
    ["web", "GET /pricing"],
    ["checkout", "POST /checkout/confirm"],
    ["ingest-gw", "POST /v1/otlp/traces"],
    ["ingest-gw", "POST /v1/otlp/metrics"],
    ["worker", "rollup.run"],
    ["status-page", "GET /upstat"],
  ];
  for (let i = 0; i < 36; i++) {
    const r = mulberry32(hashSeed(`trace:${i}`));
    const [service, name] = endpoints[Math.floor(r() * endpoints.length)];
    const inOutage = r() < 0.25;
    const start = inOutage
      ? inc42Start + Math.floor(r() * (inc42End - inc42Start))
      : now - Math.floor(r() * 4 * HOUR);
    const err = inOutage ? r() < 0.5 : r() < 0.04;
    traceSummaries.push({
      trace_id: `${(hashSeed(`tid:${i}`) >>> 0).toString(16).padStart(8, "0")}${"0".repeat(24)}`,
      root_service: service,
      root_name: name,
      start: iso(start),
      duration_ms:
        Math.round((err ? 900 + r() * 2500 : 20 + r() * 400) * 10) / 10,
      span_count: 3 + Math.floor(r() * 9),
      status: err ? "error" : "ok",
    });
  }
  traceSummaries.sort((a, b) => (a.start < b.start ? 1 : -1));

  // sparklines = 24 hourly buckets ending now; shapes cohere with state
  // (new appeared 2h ago → bars in the last 2 buckets; regressed spiked in
  // the INC-42 window ~2–3h ago → spike near bucket 21)
  const errorGroups: ErrorGroup[] = [
    {
      fingerprint: "fe4a9d21",
      message: "TypeError: Cannot read properties of undefined (reading 'map')",
      count: 128,
      first_seen: iso(now - 6 * DAY),
      last_seen: iso(now - 18 * MINUTE),
      state: "ongoing",
      sparkline: stateSparkline("err:fe4a9d21", "ongoing", 24, 8),
    },
    {
      fingerprint: "a10c33b7",
      message: "ChunkLoadError: Loading chunk 4821 failed",
      count: 46,
      first_seen: iso(now - 2 * HOUR),
      last_seen: iso(now - 4 * MINUTE),
      state: "new",
      sparkline: stateSparkline("err:a10c33b7", "new", 24, 12, {
        firstSeenBucket: 22,
      }),
    },
    {
      fingerprint: "c88e01f2",
      message: "NetworkError when attempting to fetch resource: /v1/events",
      count: 311,
      first_seen: iso(now - 40 * DAY),
      last_seen: iso(inc42End),
      state: "regressed",
      sparkline: stateSparkline("err:c88e01f2", "regressed", 24, 26, {
        spikeBucket: 21,
      }),
    },
    {
      fingerprint: "1d0b9ae4",
      message: "ResizeObserver loop completed with undelivered notifications",
      count: 74,
      first_seen: iso(now - 30 * DAY),
      last_seen: iso(now - 3 * HOUR),
      state: "ongoing",
      sparkline: stateSparkline("err:1d0b9ae4", "ongoing", 24, 4),
    },
  ];

  // Saved views (MI-18) — one org-shared (avatar stack), one personal.
  const views: SavedView[] = [
    {
      id: "view_checkout_errors",
      name: "Checkout errors",
      scope: "org",
      surface: "logs",
      query: "service:checkout level:ERROR",
      shared_with: ["Kemi", "Tola"],
      created_at: iso(now - 12 * DAY),
    },
    {
      id: "view_ingest_latency",
      name: "Ingest latency",
      scope: "personal",
      surface: "metrics",
      query: "metric:http.request.duration_ms service:ingest-gw | p95()",
      created_at: iso(now - 5 * DAY),
    },
  ];

  const { checks: synthetics, runs: syntheticRuns } = seedSynthetics(
    now,
    outage,
  );

  return {
    seededAt: now,
    outage,
    org,
    onboarding: {
      org_created: true,
      has_data: true,
      ingest_key: "uk_live_3f2a…c91d",
    },
    firstDataAtMs: null,
    statusSlug: "upstat",
    // U0-5: the slugged page over the live monitor set — row order is the
    // public page order (B7 builder, Figma 331:12857)
    statusPage: {
      name: "Upstat",
      slug: "upstat",
      components: [
        { id: "spc_homepage", name: "Homepage", monitor_id: "mon_homepage" },
        { id: "spc_api", name: "API health", monitor_id: "mon_api" },
        { id: "spc_status", name: "Status page", monitor_id: "mon_status" },
        {
          id: "spc_checkout",
          name: "Checkout flow",
          monitor_id: "mon_checkout",
        },
        { id: "spc_docs", name: "Docs", monitor_id: "mon_docs" },
      ],
    },
    members,
    dashboards,
    monitors,
    synthetics,
    syntheticRuns,
    channels,
    rules,
    alertFeed,
    incidents,
    timelines,
    postmortems,
    slos,
    catalog,
    keys,
    views,
    metricCatalog,
    heroTrace,
    traceSummaries,
    errorGroups,
  };
}

/** Delay before a fresh org "receives" its first datapoint (AFTER_TIMEOUT). */
export const FIRST_DATA_DELAY_MS = 6 * SECOND;

/** What a fresh org's metrics catalog looks like once data starts flowing. */
export function starterMetricCatalog(now: number): MetricSummary[] {
  return [
    {
      name: "http.request.duration_ms",
      type: "distribution",
      unit: "ms",
      cardinality: 24,
      ingestion_rate_per_s: 12,
      last_seen: iso(now),
      tags: ["service", "env"],
    },
    {
      name: "http.requests_total",
      type: "count",
      cardinality: 16,
      ingestion_rate_per_s: 12,
      last_seen: iso(now),
      tags: ["service", "env", "status"],
    },
    {
      name: "process.cpu.percent",
      type: "gauge",
      unit: "%",
      cardinality: 4,
      ingestion_rate_per_s: 2,
      last_seen: iso(now),
      tags: ["service", "host"],
    },
  ];
}

/**
 * Empty store for a freshly created org — the B1 first-run narrative:
 * no entities anywhere, onboarding waiting for data (MI-16 radar), the
 * telemetry endpoints gated until `firstDataAtMs` passes.
 */
export function buildEmptySeed(
  now: number,
  name: string,
  timezone: string,
): MockDb {
  const org: Org = {
    id: nextId("org"),
    name,
    timezone: timezone || "UTC",
    created_at: iso(now),
  };
  const r = mulberry32(hashSeed(`ingest:${org.id}`));
  const ingestKey = `uk_test_${Math.floor(r() * 0xffff)
    .toString(16)
    .padStart(4, "0")}…${Math.floor(r() * 0xffff)
    .toString(16)
    .padStart(4, "0")}`;
  return {
    seededAt: now,
    // no incident narrative — a zeroed window keeps the generators calm
    outage: { start: 0, end: 0, services: [] },
    org,
    onboarding: { org_created: true, has_data: false, ingest_key: ingestKey },
    firstDataAtMs: now + FIRST_DATA_DELAY_MS,
    statusSlug: null,
    statusPage: null,
    members: [
      {
        id: "usr_ibukun",
        name: "Ibukun",
        email: "ibukun@cuesoft.io",
        role: "owner",
        status: "active",
      },
    ],
    dashboards: [],
    monitors: [],
    synthetics: [],
    syntheticRuns: {},
    channels: [],
    rules: [],
    alertFeed: [],
    incidents: [],
    timelines: {},
    postmortems: {},
    slos: [],
    catalog: [],
    keys: [
      {
        id: nextId("key"),
        kind: "ingestion_token",
        name: `${name} ingest`,
        scope: "all",
        key_masked: ingestKey,
        status: "active",
        created_at: iso(now),
        rejected_count: 0,
      },
    ],
    views: [],
    metricCatalog: [],
    heroTrace: null,
    traceSummaries: [],
    errorGroups: [],
  };
}

function heroTraceSummary(t: Trace): TraceSummary {
  const {
    trace_id,
    root_service,
    root_name,
    start,
    duration_ms,
    span_count,
    status,
  } = t;
  return {
    trace_id,
    root_service,
    root_name,
    start,
    duration_ms,
    span_count,
    status,
  };
}

/**
 * State-coherent error-group sparkline (24 hourly buckets, oldest→newest —
 * realism fix 2026-07-19: pure noise contradicted the group states):
 * - `new` — flat zero until the group's first_seen, then rising bars
 * - `regressed` — low baseline with a spike in the buckets around the
 *   INC-42 window (last_seen = inc42End)
 * - `ongoing` — steady mid-level noise across the day
 */
function stateSparkline(
  key: string,
  state: ErrorGroup["state"],
  buckets: number,
  scale: number,
  opts: { firstSeenBucket?: number; spikeBucket?: number } = {},
): number[] {
  const r = mulberry32(hashSeed(key));
  return Array.from({ length: buckets }, (_, i) => {
    if (state === "new") {
      const start = opts.firstSeenBucket ?? buckets - 3;
      if (i < start) return 0;
      return Math.max(
        1,
        Math.round(
          ((i - start + 1) / (buckets - start)) * scale * (0.6 + r() * 0.6),
        ),
      );
    }
    if (state === "regressed") {
      const spike = opts.spikeBucket ?? buckets - 3;
      const dist = Math.abs(i - spike);
      const base = Math.round(r() * scale * 0.15);
      if (dist <= 1) return Math.round(scale * (0.7 + r() * 0.3));
      if (dist === 2) return Math.round(scale * 0.35 * (0.7 + r() * 0.6));
      return base;
    }
    // ongoing — steady band, never zero for long
    return Math.max(1, Math.round(scale * (0.35 + r() * 0.45)));
  });
}
