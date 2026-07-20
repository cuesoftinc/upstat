import { http, qs } from "./client";
import type {
  AlertChannel,
  AlertEvent,
  AlertRule,
  ApiKey,
  ApiKeyWithSecret,
  Dashboard,
  ErrorGroup,
  Incident,
  LogQueryPage,
  Member,
  MemberRole,
  MetricSummary,
  Monitor,
  MonitorHistory,
  OnboardingState,
  Org,
  Postmortem,
  PostmortemInput,
  QueryRequest,
  QueryResult,
  RuleTestResult,
  RumSummary,
  RumVitals,
  SavedView,
  SavedViewSurface,
  ServiceCatalogEntry,
  ServiceStats,
  Slo,
  StatusPage,
  TimelineEntry,
  Trace,
  TraceSummary,
  Widget,
} from "..";

/** Org + onboarding (pages.md B1 first-run, B12 org profile). */
export const orgsRepo = {
  current: () => http.get<Org>("/v1/orgs/current"),
  list: () => http.get<Org[]>("/v1/orgs"),
  create: (input: { name: string; timezone: string }) =>
    http.post<Org>("/v1/orgs", input),
  update: (id: string, patch: Partial<Pick<Org, "name" | "timezone">>) =>
    http.patch<Org>(`/v1/orgs/${id}`, patch),
  activate: (id: string) => http.post<Org>(`/v1/orgs/${id}/activate`),
  onboarding: () => http.get<OnboardingState>("/v1/onboarding"),
};

/** Dashboards + widgets CRUD (api.md §6; pages.md B2). */
export const dashboardsRepo = {
  list: () => http.get<Dashboard[]>("/v1/dashboards"),
  get: (id: string) => http.get<Dashboard>(`/v1/dashboards/${id}`),
  create: (input: { name: string }) =>
    http.post<Dashboard>("/v1/dashboards", input),
  update: (id: string, patch: Partial<Dashboard>) =>
    http.patch<Dashboard>(`/v1/dashboards/${id}`, patch),
  remove: (id: string) => http.delete(`/v1/dashboards/${id}`),
  addWidget: (
    dashboardId: string,
    widget: Omit<Widget, "id" | "dashboard_id">,
  ) => http.post<Widget>(`/v1/dashboards/${dashboardId}/widgets`, widget),
  updateWidget: (
    dashboardId: string,
    widgetId: string,
    patch: Partial<Widget>,
  ) =>
    http.patch<Widget>(
      `/v1/dashboards/${dashboardId}/widgets/${widgetId}`,
      patch,
    ),
  removeWidget: (dashboardId: string, widgetId: string) =>
    http.delete(`/v1/dashboards/${dashboardId}/widgets/${widgetId}`),
};

/** Shared-grammar query endpoint (api.md §6; query-grammar.md §5). */
export const queryRepo = {
  run: (req: QueryRequest) => http.post<QueryResult>("/v1/query", req),
};

/** Metrics catalog (pages.md B3 summary). */
export const metricsRepo = {
  summary: () => http.get<MetricSummary[]>("/v1/metrics/summary"),
};

/** Logs explorer + live tail (pages.md B4; MI-4). */
export const logsRepo = {
  query: (params: {
    q?: string;
    from?: string;
    to?: string;
    cursor?: string;
    limit?: number;
    live?: 1;
  }) => http.get<LogQueryPage>(`/v1/logs${qs(params)}`),
};

/** Traces / APM (pages.md B5). */
export const tracesRepo = {
  list: (params: { q?: string; from?: string; to?: string; limit?: number }) =>
    http.get<TraceSummary[]>(`/v1/traces${qs(params)}`),
  get: (traceId: string) => http.get<Trace>(`/v1/traces/${traceId}`),
  services: () => http.get<ServiceStats[]>("/v1/services"),
};

/** RUM / website analytics (pages.md B6). */
export const rumRepo = {
  summary: (params: { from?: string; to?: string } = {}) =>
    http.get<RumSummary>(`/v1/rum/summary${qs(params)}`),
  vitals: (params: { from?: string; to?: string } = {}) =>
    http.get<RumVitals>(`/v1/rum/vitals${qs(params)}`),
  errors: () => http.get<ErrorGroup[]>("/v1/rum/errors"),
};

/** Monitors / uptime checks (api.md §1 semantics over HTTP for the new IA). */
export const monitorsRepo = {
  list: () => http.get<Monitor[]>("/v1/monitors"),
  get: (id: string) => http.get<Monitor>(`/v1/monitors/${id}`),
  create: (
    input: Pick<Monitor, "name" | "target" | "type"> & Partial<Monitor>,
  ) => http.post<Monitor>("/v1/monitors", input),
  update: (id: string, patch: Partial<Monitor>) =>
    http.patch<Monitor>(`/v1/monitors/${id}`, patch),
  remove: (id: string) => http.delete(`/v1/monitors/${id}`),
  history: (id: string) =>
    http.get<MonitorHistory>(`/v1/monitors/${id}/checks`),
  /** MI-9: 24h response-time replay against timeout-derived thresholds. */
  test: (id: string) => http.post<RuleTestResult>(`/v1/monitors/${id}/test`),
};

/** Alert channels + signal-generic rules (api.md §1a/§6; pages.md B8). */
export const alertsRepo = {
  channels: () => http.get<AlertChannel[]>("/v1/channels"),
  createChannel: (input: Pick<AlertChannel, "kind" | "target">) =>
    http.post<AlertChannel>("/v1/channels", input),
  verifyChannel: (id: string) =>
    http.post<AlertChannel>(`/v1/channels/${id}/verify`),
  removeChannel: (id: string) => http.delete(`/v1/channels/${id}`),
  rules: () => http.get<AlertRule[]>("/v1/rules"),
  createRule: (
    input: Omit<AlertRule, "id" | "org_id" | "state" | "last_triggered_at">,
  ) => http.post<AlertRule>("/v1/rules", input),
  updateRule: (id: string, patch: Partial<AlertRule>) =>
    http.patch<AlertRule>(`/v1/rules/${id}`, patch),
  removeRule: (id: string) => http.delete(`/v1/rules/${id}`),
  /** MI-9: replay the last 24h against the rule's thresholds. */
  testRule: (id: string) => http.post<RuleTestResult>(`/v1/rules/${id}/test`),
  feed: () => http.get<AlertEvent[]>("/v1/alerts/feed"),
};

/** Saved views (MI-18 — QueryBar morphs into a named chip). */
export const viewsRepo = {
  list: (surface?: SavedViewSurface) =>
    http.get<SavedView[]>(`/v1/views${surface ? qs({ surface }) : ""}`),
  create: (input: Pick<SavedView, "name" | "scope" | "surface" | "query">) =>
    http.post<SavedView>("/v1/views", input),
  remove: (id: string) => http.delete(`/v1/views/${id}`),
};

/** Public status page read (pages.md B7 — unauthenticated by design). */
export const statusRepo = {
  bySlug: (slug: string) => http.get<StatusPage>(`/v1/status/${slug}`),
};

/** Incidents + timeline (api.md §6; pages.md B9; MI-10). */
export const incidentsRepo = {
  list: () => http.get<Incident[]>("/v1/incidents"),
  get: (id: string) => http.get<Incident>(`/v1/incidents/${id}`),
  declare: (input: { title: string; sev: number; commander: string }) =>
    http.post<Incident>("/v1/incidents", input),
  update: (id: string, patch: Partial<Incident>) =>
    http.patch<Incident>(`/v1/incidents/${id}`, patch),
  timeline: (id: string) =>
    http.get<TimelineEntry[]>(`/v1/incidents/${id}/timeline`),
  postUpdate: (
    id: string,
    entry: { phase?: string; body: string; author: string },
  ) => http.post<TimelineEntry>(`/v1/incidents/${id}/timeline`, entry),
  /** B9 postmortem template — resolved incidents only; 404 until composed. */
  postmortem: (id: string) =>
    http.get<Postmortem>(`/v1/incidents/${id}/postmortem`),
  savePostmortem: (id: string, input: PostmortemInput) =>
    http.put<Postmortem>(`/v1/incidents/${id}/postmortem`, input),
};

/** SLOs (pages.md B10). */
export const slosRepo = {
  list: () => http.get<Slo[]>("/v1/slos"),
  create: (
    input: Omit<
      Slo,
      | "id"
      | "org_id"
      | "current"
      | "budget_remaining_pct"
      | "burn_rate"
      | "state"
    >,
  ) => http.post<Slo>("/v1/slos", input),
  remove: (id: string) => http.delete(`/v1/slos/${id}`),
};

/** Service catalog (pages.md B11). */
export const catalogRepo = {
  list: () => http.get<ServiceCatalogEntry[]>("/v1/catalog"),
  create: (input: Omit<ServiceCatalogEntry, "id">) =>
    http.post<ServiceCatalogEntry>("/v1/catalog", input),
  update: (id: string, patch: Partial<ServiceCatalogEntry>) =>
    http.patch<ServiceCatalogEntry>(`/v1/catalog/${id}`, patch),
  remove: (id: string) => http.delete(`/v1/catalog/${id}`),
};

/** API keys & ingestion tokens (pages.md B12). */
export const keysRepo = {
  list: () => http.get<ApiKey[]>("/v1/keys"),
  create: (input: {
    kind: ApiKey["kind"];
    name: string;
    scope: ApiKey["scope"];
  }) => http.post<ApiKeyWithSecret>("/v1/keys", input),
  rotate: (id: string) => http.post<ApiKeyWithSecret>(`/v1/keys/${id}/rotate`),
  revoke: (id: string) => http.delete(`/v1/keys/${id}`),
};

/** Members & roles (pages.md B12). */
export const membersRepo = {
  list: () => http.get<Member[]>("/v1/members"),
  invite: (input: { email: string; role: MemberRole }) =>
    http.post<Member>("/v1/members", input),
  setRole: (id: string, role: MemberRole) =>
    http.patch<Member>(`/v1/members/${id}`, { role }),
  remove: (id: string) => http.delete(`/v1/members/${id}`),
};

/** GitHub star fetch (A13 runtime star count). */
export * from "./github";
