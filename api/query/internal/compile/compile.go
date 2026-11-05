// Package compile turns a query AST into ClickHouse SQL (system-design.md
// §6.5): the org predicate is always injected, the time range and every
// value travel as query parameters, never as SQL text, and the source table
// is routed by signal and time range.
package compile

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/grammar"
)

// Signal is the store a query reads.
type Signal string

const (
	Logs    Signal = "logs"
	Traces  Signal = "traces"
	Metrics Signal = "metrics"
	Checks  Signal = "checks"
	Events  Signal = "events"
)

// Detect picks the signal from the query's facets (§2 namespaces);
// explorers pass their own.
func Detect(ast *grammar.AST) Signal {
	switch {
	case grammar.HasFacet(ast, "metric"):
		return Metrics
	case grammar.HasFacet(ast, "check"), aggField(ast, "response_time_ms"):
		return Checks
	case grammar.HasFacet(ast, "trace."):
		return Traces
	case grammar.HasFacet(ast, "rum."):
		return Events
	}
	return Logs
}

func aggField(ast *grammar.AST, field string) bool {
	for _, a := range ast.Agg {
		if a.Field == field {
			return true
		}
	}
	return false
}

// Tier is the metrics table a range reads (tier routing, §6.5).
type Tier string

const (
	Raw    Tier = "raw"
	Minute Tier = "1m"
	Hour   Tier = "1h"
)

func TierFor(from, to time.Time) Tier {
	switch d := to.Sub(from); {
	case d <= 6*time.Hour:
		return Raw
	case d <= 7*24*time.Hour:
		return Minute
	}
	return Hour
}

var steps = []time.Duration{10 * time.Second, time.Minute, 5 * time.Minute, time.Hour, 24 * time.Hour}

// Step resolves "auto" (range/200 snapped to 10s/1m/5m/1h/1d) or an
// explicit duration, never finer than the tier's own grain.
func Step(spec string, from, to time.Time, tier Tier) (time.Duration, error) {
	floor := 10 * time.Second
	switch tier {
	case Minute:
		floor = time.Minute
	case Hour:
		floor = time.Hour
	}
	if spec != "" && spec != "auto" {
		d, err := time.ParseDuration(spec)
		if err != nil {
			if strings.HasSuffix(spec, "d") {
				n, nerr := strconv.Atoi(strings.TrimSuffix(spec, "d"))
				if nerr == nil && n > 0 {
					return max(time.Duration(n)*24*time.Hour, floor), nil
				}
			}
			return 0, fmt.Errorf("step must be a duration like 1m or 1h")
		}
		if d <= 0 {
			return 0, fmt.Errorf("step must be positive")
		}
		if to.Sub(from)/d > 2000 {
			return 0, fmt.Errorf("step too small for the range (max 2000 buckets)")
		}
		return max(d, floor), nil
	}
	raw := to.Sub(from) / 200
	for _, s := range steps {
		if s >= raw {
			return max(s, floor), nil
		}
	}
	return max(steps[len(steps)-1], floor), nil
}

// Request is one compiled query's inputs.
type Request struct {
	AST    *grammar.AST
	Signal Signal
	OrgID  string
	From   time.Time
	To     time.Time
	Step   time.Duration
	Tier   Tier
	// Monitors maps a monitor's name and id to its id, for check: terms.
	Monitors map[string]string
	// Histogram reads a histogram metric from its raw buckets.
	Histogram bool
	Limit     int
}

// Query is SQL plus its parameters (ClickHouse HTTP param_<name>).
type Query struct {
	SQL    string
	Params map[string]string
	// Groups and Aggs name the result columns g0.., a0.. for series.
	Groups []string
	Aggs   []grammar.Agg
}

// Error is an invalid_query raised while compiling.
type Error struct{ Message string }

func (e *Error) Error() string { return e.Message }

func invalid(format string, args ...any) error { return &Error{Message: fmt.Sprintf(format, args...)} }

type builder struct {
	req    Request
	params map[string]string
	n      int
}

func (b *builder) param(typ string, v any) string {
	b.n++
	name := "p" + strconv.Itoa(b.n)
	b.params[name] = fmt.Sprint(v)
	return "{" + name + ":" + typ + "}"
}

func (b *builder) str(v any) string { return b.param("String", v) }

// source is the FROM clause and the time column for the signal.
func (b *builder) source() (from, ts string) {
	switch b.req.Signal {
	case Traces:
		return "otel_traces", "Timestamp"
	case Checks:
		return "check_results", "scheduled_at"
	case Events:
		return "events", "ts"
	case Metrics:
		if b.req.Histogram {
			return "otel_metrics_histogram", "TimeUnix"
		}
		switch b.req.Tier {
		case Minute:
			return "metrics_1m", "bucket"
		case Hour:
			return "metrics_1h", "bucket"
		}
		return `(SELECT org_id, ServiceName, MetricName, Attributes, ResourceAttributes, TimeUnix, Value FROM otel_metrics_gauge
			UNION ALL SELECT org_id, ServiceName, MetricName, Attributes, ResourceAttributes, TimeUnix, Value FROM otel_metrics_sum)`, "TimeUnix"
	}
	return "otel_logs", "Timestamp"
}

// attrMap is where @attributes live for the signal.
func (b *builder) attrMap() string {
	switch b.req.Signal {
	case Traces:
		return "SpanAttributes"
	case Metrics:
		return "Attributes"
	case Events:
		return "dims"
	}
	return "LogAttributes"
}

func (b *builder) resource(key string) string {
	if b.req.Signal == Metrics && b.req.Tier != Raw && !b.req.Histogram {
		return "Attributes['" + key + "']" // rollups keep only point attributes
	}
	return "ResourceAttributes['" + key + "']"
}

// facet returns the SQL expression for a facet on this signal.
func (b *builder) facet(f string) (string, error) {
	s := b.req.Signal
	switch {
	case strings.HasPrefix(f, "@"):
		key := strings.TrimPrefix(f, "@")
		if s == Events {
			key = "dim." + key
		}
		return b.attrMap() + "[" + b.str(key) + "]", nil
	case strings.HasPrefix(f, "metric.") && s == Metrics:
		return "Attributes[" + b.str(strings.TrimPrefix(f, "metric.")) + "]", nil
	}
	switch f {
	case "service":
		if s == Logs || s == Traces || s == Metrics {
			return "ServiceName", nil
		}
	case "env":
		if s == Logs || s == Traces || s == Metrics {
			return b.resource("deployment.environment"), nil
		}
	case "host":
		if s == Logs || s == Traces || s == Metrics {
			return b.resource("host.name"), nil
		}
	case "level":
		if s == Logs {
			return "lower(SeverityText)", nil
		}
	case "status":
		switch s {
		case Logs:
			return "lower(SeverityText)", nil
		case Traces:
			return "if(StatusCode = 'Error', 'error', 'ok')", nil
		case Checks:
			return "if(ok, 'up', 'down')", nil
		}
	case "region":
		if s == Checks {
			return "region", nil
		}
	case "status_code":
		if s == Checks {
			return "status_code", nil
		}
	case "response_time_ms":
		if s == Checks {
			return "total_ms", nil
		}
	case "name":
		switch s {
		case Events:
			return "name", nil
		case Traces:
			return "SpanName", nil
		case Metrics:
			return "MetricName", nil
		}
	case "trace.duration_ms":
		if s == Traces {
			return "(Duration / 1e6)", nil
		}
	case "trace.endpoint":
		if s == Traces {
			return "SpanName", nil
		}
	case "trace.error":
		if s == Traces {
			return "if(StatusCode = 'Error', 'true', 'false')", nil
		}
	case "trace.kind":
		if s == Traces {
			return "lower(SpanKind)", nil
		}
	case "trace.id":
		if s == Traces || s == Logs {
			return "TraceId", nil
		}
	case "rum.path":
		if s == Events {
			return "path", nil
		}
	case "rum.country":
		if s == Events {
			return "country", nil
		}
	case "rum.device":
		if s == Events {
			return "device_class", nil
		}
	case "rum.referrer":
		if s == Events {
			return "referrer_host", nil
		}
	case "rum.event", "rum.name":
		if s == Events {
			return "name", nil
		}
	}
	if strings.HasPrefix(f, "rum.vital.") && s == Events {
		return "value", nil
	}
	if strings.HasPrefix(f, "trace.") && s == Traces {
		return "SpanAttributes[" + b.str(strings.TrimPrefix(f, "trace.")) + "]", nil
	}
	return "", invalid("facet %s does not apply to %s", f, s)
}

func numeric(expr string) string {
	if strings.HasPrefix(expr, "(Duration") || expr == "total_ms" || expr == "value" || expr == "status_code" {
		return expr
	}
	return "toFloat64OrNull(toString(" + expr + "))"
}

var cmpOps = map[string]string{"eq": "=", "gt": ">", "gte": ">=", "lt": "<", "lte": "<="}

// cmp maps a comparator to its operator; anything else is invalid_query.
func cmp(op string) (string, error) {
	if sql, ok := cmpOps[op]; ok {
		return sql, nil
	}
	return "", invalid("unknown comparator %q", op)
}

func (b *builder) term(t grammar.Term) (string, error) {
	switch {
	case t.Not != nil:
		inner, err := b.term(*t.Not)
		if err != nil {
			return "", err
		}
		return "NOT (" + inner + ")", nil
	case t.Op != "":
		parts := make([]string, 0, len(t.Terms))
		for _, c := range t.Terms {
			p, err := b.term(c)
			if err != nil {
				return "", err
			}
			parts = append(parts, "("+p+")")
		}
		joiner := " AND "
		if t.Op == "or" {
			joiner = " OR "
		}
		return strings.Join(parts, joiner), nil
	case t.Text != nil:
		return b.text(*t.Text)
	}
	return b.facetTerm(t)
}

func (b *builder) text(s string) (string, error) {
	switch b.req.Signal {
	case Logs:
		return "positionCaseInsensitiveUTF8(Body, " + b.str(s) + ") > 0", nil
	case Traces:
		return "positionCaseInsensitiveUTF8(SpanName, " + b.str(s) + ") > 0", nil
	case Events:
		return "positionCaseInsensitiveUTF8(name, " + b.str(s) + ") > 0", nil
	case Metrics:
		return "positionCaseInsensitiveUTF8(MetricName, " + b.str(s) + ") > 0", nil
	}
	return "", invalid("free text does not apply to checks")
}

func (b *builder) facetTerm(t grammar.Term) (string, error) {
	switch t.Facet {
	case "metric":
		return "MetricName = " + b.str(t.Value), nil
	case "on":
		return "1", nil // uptime rule metadata, not a filter
	case "check":
		id, ok := b.req.Monitors[fmt.Sprint(t.Value)]
		if !ok {
			return "", invalid("unknown check: %v", t.Value)
		}
		return "monitor_id = " + b.str(id), nil
	}
	if strings.HasPrefix(t.Facet, "rum.vital.") {
		vital := strings.TrimPrefix(t.Facet, "rum.vital.")
		cond := "name = 'web_vital' AND dims['dim.metric'] = " + b.str(vital)
		if t.Cmp == "eq" && fmt.Sprint(t.Value) == "" {
			return cond, nil
		}
		op, err := cmp(t.Cmp)
		if err != nil {
			return "", err
		}
		return cond + " AND value " + op + " " + b.param("Float64", t.Value), nil
	}
	expr, err := b.facet(t.Facet)
	if err != nil {
		return "", err
	}
	if _, isNum := t.Value.(float64); isNum || t.Cmp != "eq" {
		op, err := cmp(t.Cmp)
		if err != nil {
			return "", err
		}
		return numeric(expr) + " " + op + " " + b.param("Float64", t.Value), nil
	}
	if t.Facet == "status" && b.req.Signal == Logs && fmt.Sprint(t.Value) == "error" {
		return "lower(SeverityText) IN ('error', 'fatal')", nil
	}
	return "toString(" + expr + ") = " + b.str(t.Value), nil
}

// aggExpr is one aggregation's SQL for the signal and tier.
func (b *builder) aggExpr(a grammar.Agg) (string, error) {
	stepSeconds := strconv.FormatFloat(b.req.Step.Seconds(), 'f', -1, 64)
	if b.req.Signal == Metrics {
		return b.metricAgg(a, stepSeconds)
	}
	field := ""
	if a.Field != "" {
		if a.Field == "visitor" && b.req.Signal == Events {
			field = "nullIf(visitor_hash, '')"
		} else {
			expr, err := b.facet(a.Field)
			if err != nil {
				return "", err
			}
			field = expr
		}
	} else if b.req.Signal == Checks {
		field = "total_ms"
	}
	switch a.Fn {
	case "count":
		return "toFloat64(count())", nil
	case "rate":
		if b.req.Signal == Checks {
			return "avg(ok)", nil // pass ratio, the documented exception (§4)
		}
		return "count() / " + stepSeconds, nil
	case "uniq":
		return "toFloat64(uniqExact(" + field + "))", nil
	case "sum", "avg", "min", "max":
		return a.Fn + "(" + numeric(field) + ")", nil
	case "p50", "p95", "p99":
		return "quantile(0." + a.Fn[1:] + ")(" + numeric(field) + ")", nil
	}
	return "", invalid("unknown function %s", a.Fn)
}

var quantileIndex = map[string]string{"p50": "1", "p95": "2", "p99": "3"}

func (b *builder) metricAgg(a grammar.Agg, stepSeconds string) (string, error) {
	if a.Fn == "rate" {
		return "", invalid("rate() does not apply to metrics; use the metric itself")
	}
	if a.Fn == "uniq" {
		return "toFloat64(uniqExact(Attributes))", nil
	}
	if b.req.Histogram {
		switch a.Fn {
		case "count":
			return "toFloat64(sum(Count))", nil
		case "sum":
			return "sum(Sum)", nil
		case "avg":
			return "sum(Sum) / nullIf(sum(Count), 0)", nil
		case "min":
			return "min(Min)", nil
		case "max":
			return "max(Max)", nil
		}
		// Bucket-weighted quantile over each bucket's upper bound (the
		// overflow bucket reports the observed max); assumes delta
		// temporality, which the OTel SDKs' exporters can be set to.
		return "quantileWeighted(0." + a.Fn[1:] + ")(b.1, b.2)", nil
	}
	if b.req.Tier == Raw {
		switch a.Fn {
		case "count":
			return "toFloat64(count())", nil
		case "p50", "p95", "p99":
			return "quantile(0." + a.Fn[1:] + ")(Value)", nil
		}
		return a.Fn + "(Value)", nil
	}
	switch a.Fn {
	case "count":
		return "toFloat64(sum(count_value))", nil
	case "sum":
		return "sum(sum_value)", nil
	case "avg":
		return "sum(sum_value) / nullIf(sum(count_value), 0)", nil
	case "min":
		return "min(min_value)", nil
	case "max":
		return "max(max_value)", nil
	}
	return "quantilesMerge(0.5, 0.95, 0.99)(quantiles)[" + quantileIndex[a.Fn] + "]", nil
}

// where is the WHERE clause: org, range, signal guards and the filters.
func (b *builder) where(ts string) (string, error) {
	conds := []string{
		"org_id = " + b.str(b.req.OrgID),
		ts + " >= " + b.param("DateTime64(3)", b.req.From.UTC().Format("2006-01-02 15:04:05.000")),
		ts + " < " + b.param("DateTime64(3)", b.req.To.UTC().Format("2006-01-02 15:04:05.000")),
	}
	if b.req.Signal == Logs {
		conds = append(conds, "ServiceName NOT LIKE 'upstat.%'") // Upstat's own rows have their tables
	}
	for _, t := range b.req.AST.Filters.Terms {
		c, err := b.term(t)
		if err != nil {
			return "", err
		}
		if c != "1" {
			conds = append(conds, "("+c+")")
		}
	}
	return strings.Join(conds, " AND "), nil
}

// Series compiles an aggregated query into one row per bucket and group.
func Series(req Request) (*Query, error) {
	if len(req.AST.Agg) == 0 {
		return nil, invalid("a series needs an aggregation (| count() …)")
	}
	b := &builder{req: req, params: map[string]string{}}
	from, ts := b.source()
	where, err := b.where(ts)
	if err != nil {
		return nil, err
	}
	cols := []string{fmt.Sprintf("toStartOfInterval(%s, INTERVAL %d SECOND) AS t", ts, int(req.Step.Seconds()))}
	group := []string{"t"}
	for i, g := range req.AST.GroupBy {
		expr, err := b.groupExpr(g)
		if err != nil {
			return nil, err
		}
		cols = append(cols, fmt.Sprintf("toString(%s) AS g%d", expr, i))
		group = append(group, fmt.Sprintf("g%d", i))
	}
	for i, a := range req.AST.Agg {
		expr, err := b.aggExpr(a)
		if err != nil {
			return nil, err
		}
		cols = append(cols, fmt.Sprintf("%s AS a%d", expr, i))
	}
	arrayJoin := ""
	if req.Signal == Metrics && req.Histogram {
		arrayJoin = " ARRAY JOIN arrayZip(arrayPushBack(ExplicitBounds, Max), BucketCounts) AS b"
	}
	limit := req.Limit
	if limit <= 0 {
		limit = 50000
	}
	sql := fmt.Sprintf("SELECT %s FROM %s%s WHERE %s GROUP BY %s ORDER BY t LIMIT %d",
		strings.Join(cols, ", "), from, arrayJoin, where, strings.Join(group, ", "), limit)
	return &Query{SQL: sql, Params: b.params, Groups: req.AST.GroupBy, Aggs: req.AST.Agg}, nil
}

// groupExpr admits any facet for the signal; on metrics an unknown name is
// a tag (§2: remaining terms filter tags).
func (b *builder) groupExpr(g string) (string, error) {
	expr, err := b.facet(g)
	if err == nil {
		return expr, nil
	}
	switch b.req.Signal {
	case Metrics:
		return "Attributes[" + b.str(g) + "]", nil
	case Logs, Traces:
		return b.attrMap() + "[" + b.str(g) + "]", nil
	case Events:
		return "dims[" + b.str("dim."+g) + "]", nil
	}
	return "", err
}

// Rows compiles an unaggregated query into the raw stream, newest first.
func Rows(req Request) (*Query, error) {
	b := &builder{req: req, params: map[string]string{}}
	from, ts := b.source()
	where, err := b.where(ts)
	if err != nil {
		return nil, err
	}
	var cols string
	switch req.Signal {
	case Logs:
		cols = "Timestamp AS ts, ServiceName AS service, SeverityText AS level, Body AS message"
	case Traces:
		cols = "Timestamp AS ts, ServiceName AS service, SpanName AS name, Duration / 1e6 AS duration_ms, StatusCode AS status, TraceId AS trace_id"
	case Checks:
		cols = "scheduled_at AS ts, monitor_id, region, ok, cause, status_code, total_ms"
	case Events:
		cols = "ts, name, path, referrer_host, device_class, country, value"
	case Metrics:
		if req.Tier != Raw || req.Histogram {
			return nil, invalid("raw metric points are kept for 6 hours; add an aggregation or narrow the range")
		}
		cols = "TimeUnix AS ts, ServiceName AS service, MetricName AS metric, Value AS value"
	}
	limit := req.Limit
	if limit <= 0 || limit > 1000 {
		limit = 1000
	}
	sql := fmt.Sprintf("SELECT %s FROM %s WHERE %s ORDER BY %s DESC LIMIT %d", cols, from, where, ts, limit)
	return &Query{SQL: sql, Params: b.params}, nil
}

// Where exposes the filter clause for the explorers' own SELECTs.
func Where(req Request) (string, map[string]string, error) {
	b := &builder{req: req, params: map[string]string{}}
	_, ts := b.source()
	w, err := b.where(ts)
	return w, b.params, err
}
