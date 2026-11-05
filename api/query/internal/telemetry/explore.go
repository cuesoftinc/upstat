package telemetry

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
	"github.com/cuesoftinc/upstat/api/query/internal/compile"
)

// where compiles q's filters for one signal over [from, to).
func (s *Service) where(orgID, q string, signal compile.Signal, from, to time.Time) (string, map[string]string, error) {
	ast, err := Parse(q)
	if err != nil {
		return "", nil, err
	}
	if len(ast.Agg) > 0 {
		return "", nil, bad("invalid_query", "explorers take filters only; aggregate through /v1/query")
	}
	req := compile.Request{AST: ast, Signal: signal, OrgID: orgID, From: from, To: to, Tier: compile.Raw}
	if s.Monitors != nil {
		req.Monitors = s.Monitors(orgID)
	}
	w, params, err := compile.Where(req)
	return w, params, compileErr(err)
}

func ts(t time.Time) string { return t.UTC().Format("2006-01-02 15:04:05.000000000") }

// ── Logs (pages.md B4) ──────────────────────────────────────────────────

type LogEvent struct {
	ID      string         `json:"id"`
	TS      time.Time      `json:"ts"`
	Service string         `json:"service"`
	Level   string         `json:"level"`
	Host    string         `json:"host"`
	Message string         `json:"message"`
	Attrs   map[string]any `json:"attrs"`
	TraceID string         `json:"trace_id,omitempty"`
}

type FacetCount struct {
	Value string `json:"value"`
	Count int64  `json:"count"`
}

type HistogramBucket struct {
	TS     time.Time        `json:"ts"`
	Counts map[string]int64 `json:"counts"`
}

type LogPage struct {
	Events     []LogEvent              `json:"events"`
	NextCursor string                  `json:"next_cursor,omitempty"`
	Histogram  []HistogramBucket       `json:"histogram"`
	Facets     map[string][]FacetCount `json:"facets"`
}

var logLevels = []string{"TRACE", "DEBUG", "INFO", "WARN", "ERROR"}

// normLevel folds OTel severities onto the five explorer levels.
const normLevel = `multiIf(upper(SeverityText) IN ('FATAL', 'ERROR', 'CRITICAL'), 'ERROR', upper(SeverityText) IN ('WARN', 'WARNING'), 'WARN',
	upper(SeverityText) = 'DEBUG', 'DEBUG', upper(SeverityText) = 'TRACE', 'TRACE', 'INFO')`

type LogParams struct {
	Q, From, To, Cursor string
	Limit               int
	Live                bool
}

func (s *Service) Logs(ctx context.Context, orgID string, p LogParams) (*LogPage, error) {
	now := s.Now().UTC()
	from, to, err := Range(p.From, p.To, now, time.Hour)
	if err != nil {
		return nil, err
	}
	if p.Live {
		from, to = now.Add(-15*time.Second), now
	}
	before := to
	if p.Cursor != "" {
		if before, err = time.Parse(time.RFC3339Nano, p.Cursor); err != nil {
			return nil, bad("bad_shape", "invalid cursor")
		}
	}
	if p.Limit <= 0 {
		p.Limit = 100
	}
	p.Limit = min(p.Limit, 10000)
	where, params, err := s.where(orgID, p.Q, compile.Logs, from, to)
	if err != nil {
		return nil, err
	}
	params["x_before"] = ts(before)
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT Timestamp, ServiceName, %s AS level, ResourceAttributes['host.name'] AS host, Body,
			LogAttributes, TraceId, toString(cityHash64(Timestamp, ServiceName, Body)) AS id
		FROM otel_logs WHERE %s AND Timestamp < {x_before:DateTime64(9)} ORDER BY Timestamp DESC LIMIT %d`, normLevel, where, p.Limit+1), params)
	if err != nil {
		return nil, err
	}
	page := &LogPage{Events: []LogEvent{}, Histogram: []HistogramBucket{}, Facets: map[string][]FacetCount{}}
	for i, r := range rows {
		if i == p.Limit {
			page.NextCursor = chdb.Time(rows[i-1]["Timestamp"]).Format(time.RFC3339Nano)
			break
		}
		attrs := map[string]any{}
		if m, ok := r["LogAttributes"].(map[string]any); ok {
			attrs = m
		}
		page.Events = append(page.Events, LogEvent{ID: chdb.Str(r["id"]), TS: chdb.Time(r["Timestamp"]), Service: chdb.Str(r["ServiceName"]),
			Level: chdb.Str(r["level"]), Host: chdb.Str(r["host"]), Message: chdb.Str(r["Body"]), Attrs: attrs, TraceID: chdb.Str(r["TraceId"])})
	}
	step, _ := compile.Step("auto", from, to, compile.Raw)
	hist, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT toStartOfInterval(Timestamp, INTERVAL %d SECOND) AS t, %s AS level, count() AS c
		FROM otel_logs WHERE %s GROUP BY t, level ORDER BY t`, int(step.Seconds()), normLevel, where), params)
	if err != nil {
		return nil, err
	}
	buckets := map[int64]*HistogramBucket{}
	var order []int64
	for _, r := range hist {
		t := chdb.Time(r["t"])
		b := buckets[t.Unix()]
		if b == nil {
			b = &HistogramBucket{TS: t, Counts: map[string]int64{}}
			for _, l := range logLevels {
				b.Counts[l] = 0
			}
			buckets[t.Unix()] = b
			order = append(order, t.Unix())
		}
		c, _ := chdb.Float(r["c"])
		b.Counts[chdb.Str(r["level"])] += int64(c)
	}
	for _, k := range order {
		page.Histogram = append(page.Histogram, *buckets[k])
	}
	for facet, expr := range map[string]string{"service": "ServiceName", "level": normLevel, "host": "ResourceAttributes['host.name']"} {
		rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS v, count() AS c FROM otel_logs WHERE %s AND v != ''
			GROUP BY v ORDER BY c DESC LIMIT 10`, expr, where), params)
		if err != nil {
			return nil, err
		}
		page.Facets[facet] = counts(rows)
	}
	return page, nil
}

func counts(rows []map[string]any) []FacetCount {
	out := []FacetCount{}
	for _, r := range rows {
		c, _ := chdb.Float(r["c"])
		out = append(out, FacetCount{Value: chdb.Str(r["v"]), Count: int64(c)})
	}
	return out
}

// ── Log patterns (OBS-012) ──────────────────────────────────────────────

type LogPattern struct {
	Template      string     `json:"template"`
	Count         int64      `json:"count"`
	DominantLevel string     `json:"dominant_level"`
	Trend         []int64    `json:"trend"`
	Samples       []LogEvent `json:"samples"`
}

type PatternsResult struct {
	Patterns   []LogPattern `json:"patterns"`
	TotalLines int64        `json:"total_lines"`
	BucketMs   int64        `json:"bucket_ms"`
	Sampled    bool         `json:"sampled"`
}

// template masks the variable parts of a log line: ids, numbers, quoted
// strings, so lines that differ only there cluster together.
const template = `replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(replaceRegexpAll(Body,
	'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}', '<uuid>'),
	'\\b[0-9a-fA-F]{16,}\\b', '<hex>'), '"[^"]*"', '<str>'), '\\b\\d+(\\.\\d+)?\\b', '<num>')`

const patternSampleCap = 1_000_000

func (s *Service) Patterns(ctx context.Context, orgID, q, fromRaw, toRaw string) (*PatternsResult, error) {
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), time.Hour)
	if err != nil {
		return nil, err
	}
	where, params, err := s.where(orgID, q, compile.Logs, from, to)
	if err != nil {
		return nil, err
	}
	total, err := s.CH.Rows(ctx, orgID, "SELECT count() AS c FROM otel_logs WHERE "+where, params)
	if err != nil {
		return nil, err
	}
	n, _ := chdb.Float(total[0]["c"])
	out := &PatternsResult{Patterns: []LogPattern{}, TotalLines: int64(n)}
	if n == 0 {
		return out, nil
	}
	bucket := to.Sub(from) / 7
	out.BucketMs = bucket.Milliseconds()
	stride := int64(1)
	if int64(n) > patternSampleCap {
		stride = int64(n)/patternSampleCap + 1
		out.Sampled = true
	}
	params["x_from"] = ts(from)
	var trend []string
	for i := range 7 {
		trend = append(trend, fmt.Sprintf("countIf(b = %d)", i))
	}
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT %s AS tpl, count() AS c, topK(1)(%s)[1] AS lvl,
			[%s] AS trend,
			groupArray(3)(tuple(Timestamp, ServiceName, %s, ResourceAttributes['host.name'], Body)) AS samples
		FROM (SELECT *, least(6, intDiv(toUnixTimestamp64Milli(Timestamp) - toUnixTimestamp64Milli({x_from:DateTime64(9)}), %d)) AS b
			FROM otel_logs WHERE %s AND cityHash64(Timestamp, Body) %% %d = 0 ORDER BY Timestamp DESC)
		GROUP BY tpl ORDER BY c DESC LIMIT 50`, template, normLevel, strings.Join(trend, ", "), normLevel, bucket.Milliseconds(), where, stride), params)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		c, _ := chdb.Float(r["c"])
		p := LogPattern{Template: chdb.Str(r["tpl"]), Count: int64(c) * stride, DominantLevel: chdb.Str(r["lvl"]), Trend: []int64{},
			Samples: []LogEvent{}}
		if arr, ok := r["trend"].([]any); ok {
			for _, v := range arr {
				f, _ := chdb.Float(v)
				p.Trend = append(p.Trend, int64(f)*stride)
			}
		}
		if arr, ok := r["samples"].([]any); ok {
			for _, v := range arr {
				t, ok := v.([]any)
				if !ok || len(t) < 5 {
					continue
				}
				p.Samples = append(p.Samples, LogEvent{TS: chdb.Time(t[0]), Service: chdb.Str(t[1]), Level: chdb.Str(t[2]),
					Host: chdb.Str(t[3]), Message: chdb.Str(t[4]), Attrs: map[string]any{}})
			}
		}
		out.Patterns = append(out.Patterns, p)
	}
	return out, nil
}

// ── Traces (pages.md B5) ────────────────────────────────────────────────

type TraceSummary struct {
	TraceID     string    `json:"trace_id"`
	RootService string    `json:"root_service"`
	RootName    string    `json:"root_name"`
	Start       time.Time `json:"start"`
	DurationMs  float64   `json:"duration_ms"`
	SpanCount   int64     `json:"span_count"`
	Status      string    `json:"status"`
}

type Span struct {
	TraceID    string            `json:"trace_id"`
	SpanID     string            `json:"span_id"`
	ParentID   *string           `json:"parent_id"`
	Service    string            `json:"service"`
	Name       string            `json:"name"`
	Start      time.Time         `json:"start"`
	DurationNs int64             `json:"duration_ns"`
	Status     string            `json:"status"`
	Attrs      map[string]string `json:"attrs"`
}

type Trace struct {
	TraceSummary
	Spans []Span `json:"spans"`
}

func (s *Service) Traces(ctx context.Context, orgID, q, fromRaw, toRaw string, limit int) ([]TraceSummary, error) {
	from, to, err := Range(fromRaw, toRaw, s.Now().UTC(), time.Hour)
	if err != nil {
		return nil, err
	}
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	where, params, err := s.where(orgID, q, compile.Traces, from, to)
	if err != nil {
		return nil, err
	}
	roots, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT TraceId, ServiceName, SpanName, Timestamp, Duration / 1e6 AS ms
		FROM otel_traces WHERE %s AND ParentSpanId = '' ORDER BY Timestamp DESC LIMIT %d`, where, limit), params)
	if err != nil || len(roots) == 0 {
		return []TraceSummary{}, err
	}
	ids := make([]string, len(roots))
	for i, r := range roots {
		ids[i] = chdb.Str(r["TraceId"])
	}
	stats, err := s.CH.Rows(ctx, orgID, `SELECT TraceId, count() AS spans, countIf(StatusCode = 'Error') AS errors
		FROM otel_traces WHERE org_id = {o:String} AND Timestamp >= {f:DateTime64(9)} - INTERVAL 1 HOUR
			AND Timestamp < {t:DateTime64(9)} + INTERVAL 1 HOUR AND TraceId IN {ids:Array(String)} GROUP BY TraceId`,
		map[string]string{"o": orgID, "f": ts(from), "t": ts(to), "ids": chdb.ArrayParam(ids)})
	if err != nil {
		return nil, err
	}
	byID := map[string]map[string]any{}
	for _, r := range stats {
		byID[chdb.Str(r["TraceId"])] = r
	}
	out := make([]TraceSummary, 0, len(roots))
	for _, r := range roots {
		id := chdb.Str(r["TraceId"])
		ms, _ := chdb.Float(r["ms"])
		sum := TraceSummary{TraceID: id, RootService: chdb.Str(r["ServiceName"]), RootName: chdb.Str(r["SpanName"]),
			Start: chdb.Time(r["Timestamp"]), DurationMs: ms, SpanCount: 1, Status: "ok"}
		if st := byID[id]; st != nil {
			n, _ := chdb.Float(st["spans"])
			e, _ := chdb.Float(st["errors"])
			sum.SpanCount = int64(n)
			if e > 0 {
				sum.Status = "error"
			}
		}
		out = append(out, sum)
	}
	return out, nil
}

func (s *Service) Trace(ctx context.Context, orgID, traceID string) (*Trace, error) {
	if len(traceID) != 32 || strings.Trim(traceID, "0123456789abcdef") != "" {
		return nil, nil
	}
	now := s.Now().UTC()
	from, to := now.Add(-7*24*time.Hour), now.Add(time.Hour)
	window, err := s.CH.Rows(ctx, orgID, `SELECT min(Start) AS s, max(End) AS e FROM otel_traces_trace_id_ts WHERE org_id = {o:String} AND TraceId = {id:String}`,
		map[string]string{"o": orgID, "id": traceID})
	if err == nil && len(window) == 1 && !chdb.Time(window[0]["s"]).IsZero() && chdb.Time(window[0]["s"]).Year() > 1971 {
		from, to = chdb.Time(window[0]["s"]).Add(-time.Minute), chdb.Time(window[0]["e"]).Add(time.Minute)
	}
	rows, err := s.CH.Rows(ctx, orgID, `SELECT TraceId, SpanId, ParentSpanId, ServiceName, SpanName, Timestamp, Duration, StatusCode, SpanAttributes
		FROM otel_traces WHERE org_id = {o:String} AND TraceId = {id:String} AND Timestamp >= {f:DateTime64(9)} AND Timestamp <= {t:DateTime64(9)}
		ORDER BY Timestamp LIMIT 10000`, map[string]string{"o": orgID, "id": traceID, "f": ts(from), "t": ts(to)})
	if err != nil || len(rows) == 0 {
		return nil, err
	}
	tr := &Trace{Spans: []Span{}}
	var end time.Time
	for _, r := range rows {
		d, _ := chdb.Float(r["Duration"])
		sp := Span{TraceID: traceID, SpanID: chdb.Str(r["SpanId"]), Service: chdb.Str(r["ServiceName"]), Name: chdb.Str(r["SpanName"]),
			Start: chdb.Time(r["Timestamp"]), DurationNs: int64(d), Status: "ok", Attrs: map[string]string{}}
		if p := chdb.Str(r["ParentSpanId"]); p != "" {
			sp.ParentID = &p
		}
		if chdb.Str(r["StatusCode"]) == "Error" {
			sp.Status = "error"
			tr.Status = "error"
		}
		if m, ok := r["SpanAttributes"].(map[string]any); ok {
			for k, v := range m {
				sp.Attrs[k] = chdb.Str(v)
			}
		}
		if sp.ParentID == nil && tr.RootName == "" {
			tr.RootService, tr.RootName = sp.Service, sp.Name
		}
		if e := sp.Start.Add(time.Duration(sp.DurationNs)); e.After(end) {
			end = e
		}
		tr.Spans = append(tr.Spans, sp)
	}
	tr.TraceID, tr.Start, tr.SpanCount = traceID, tr.Spans[0].Start, int64(len(tr.Spans))
	if tr.RootName == "" {
		tr.RootService, tr.RootName = tr.Spans[0].Service, tr.Spans[0].Name
	}
	if tr.Status == "" {
		tr.Status = "ok"
	}
	tr.DurationMs = float64(end.Sub(tr.Start).Microseconds()) / 1000
	return tr, nil
}

type ServiceStats struct {
	Service   string  `json:"service"`
	ReqPerS   float64 `json:"req_per_s"`
	P50Ms     float64 `json:"p50_ms"`
	P95Ms     float64 `json:"p95_ms"`
	P99Ms     float64 `json:"p99_ms"`
	ErrorRate float64 `json:"error_rate"`
	Apdex     float64 `json:"apdex"`
}

// apdexT is the satisfied threshold (500 ms); tolerating is up to 4T.
const apdexT = 500

// Services is the APM list over the last hour of server spans.
func (s *Service) Services(ctx context.Context, orgID string) ([]ServiceStats, error) {
	now := s.Now().UTC()
	rows, err := s.CH.Rows(ctx, orgID, fmt.Sprintf(`SELECT ServiceName AS service, count() / 3600 AS rps,
			quantiles(0.5, 0.95, 0.99)(Duration / 1e6) AS q, countIf(StatusCode = 'Error') / count() AS err,
			(countIf(Duration / 1e6 <= %d) + countIf(Duration / 1e6 > %d AND Duration / 1e6 <= %d) / 2) / count() AS apdex
		FROM otel_traces WHERE org_id = {o:String} AND Timestamp >= {f:DateTime64(9)} AND positionCaseInsensitive(SpanKind, 'server') > 0
		GROUP BY service ORDER BY rps DESC LIMIT 200`, apdexT, apdexT, 4*apdexT),
		map[string]string{"o": orgID, "f": ts(now.Add(-time.Hour))})
	if err != nil {
		return nil, err
	}
	out := []ServiceStats{}
	for _, r := range rows {
		st := ServiceStats{Service: chdb.Str(r["service"])}
		st.ReqPerS, _ = chdb.Float(r["rps"])
		st.ErrorRate, _ = chdb.Float(r["err"])
		st.Apdex, _ = chdb.Float(r["apdex"])
		if q, ok := r["q"].([]any); ok && len(q) == 3 {
			st.P50Ms, _ = chdb.Float(q[0])
			st.P95Ms, _ = chdb.Float(q[1])
			st.P99Ms, _ = chdb.Float(q[2])
		}
		st.ReqPerS, st.ErrorRate, st.Apdex = round(st.ReqPerS, 3), round(st.ErrorRate, 4), round(st.Apdex, 2)
		out = append(out, st)
	}
	return out, nil
}

func round(f float64, places int) float64 {
	v, _ := strconv.ParseFloat(strconv.FormatFloat(f, 'f', places, 64), 64)
	return v
}

// ── Metrics catalog (pages.md B3) ───────────────────────────────────────

type MetricSummary struct {
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Unit        string    `json:"unit,omitempty"`
	Cardinality int64     `json:"cardinality"`
	IngestRateS float64   `json:"ingestion_rate_per_s"`
	LastSeen    time.Time `json:"last_seen"`
	Tags        []string  `json:"tags"`
}

func (s *Service) MetricsSummary(ctx context.Context, orgID string) ([]MetricSummary, error) {
	now := s.Now().UTC()
	rows, err := s.CH.Rows(ctx, orgID, `SELECT MetricName AS name, any(kind) AS type, any(MetricUnit) AS unit, uniqExact(Attributes) AS card,
			count() / 3600 AS rate, max(TimeUnix) AS last, arraySlice(groupUniqArrayArray(mapKeys(Attributes)), 1, 20) AS tags
		FROM (
			SELECT MetricName, MetricUnit, Attributes, TimeUnix, 'gauge' AS kind FROM otel_metrics_gauge WHERE org_id = {o:String} AND TimeUnix >= {f:DateTime64(9)}
			UNION ALL SELECT MetricName, MetricUnit, Attributes, TimeUnix, 'count' FROM otel_metrics_sum WHERE org_id = {o:String} AND TimeUnix >= {f:DateTime64(9)}
			UNION ALL SELECT MetricName, MetricUnit, Attributes, TimeUnix, 'distribution' FROM otel_metrics_histogram WHERE org_id = {o:String} AND TimeUnix >= {f:DateTime64(9)})
		GROUP BY name ORDER BY name LIMIT 2000`, map[string]string{"o": orgID, "f": ts(now.Add(-time.Hour))})
	if err != nil {
		return nil, err
	}
	out := []MetricSummary{}
	for _, r := range rows {
		m := MetricSummary{Name: chdb.Str(r["name"]), Type: chdb.Str(r["type"]), Unit: chdb.Str(r["unit"]), LastSeen: chdb.Time(r["last"]), Tags: []string{}}
		c, _ := chdb.Float(r["card"])
		m.Cardinality = int64(c)
		rate, _ := chdb.Float(r["rate"])
		m.IngestRateS = round(rate, 3)
		if tags, ok := r["tags"].([]any); ok {
			for _, t := range tags {
				m.Tags = append(m.Tags, chdb.Str(t))
			}
		}
		sort.Strings(m.Tags)
		out = append(out, m)
	}
	return out, nil
}
