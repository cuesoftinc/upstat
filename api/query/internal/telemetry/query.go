// Package telemetry answers every read of the telemetry plane: the shared
// query (POST /v1/query), the explorers, RUM and stats, usage, and the
// internal reads common and analytics make (system-design.md §6.5).
package telemetry

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
	"github.com/cuesoftinc/upstat/api/query/internal/compile"
	"github.com/cuesoftinc/upstat/api/query/internal/grammar"
)

// Reader runs SQL for an org; *chdb.Client is the real one.
type Reader interface {
	Rows(ctx context.Context, orgID, sql string, params map[string]string) ([]map[string]any, error)
}

type Service struct {
	CH       Reader
	Monitors func(orgID string) map[string]string
	Now      func() time.Time
}

// MaxRange is the longest window any read accepts (api.md §3.3).
const MaxRange = 92 * 24 * time.Hour

// Error is a client mistake reported as 422 with a stable code.
type Error struct {
	Code    string
	Message string
	Details map[string]any
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func bad(code, msg string) *Error { return &Error{Code: code, Message: msg} }

// Range validates [from, to): RFC3339, ordered, at most MaxRange.
func Range(fromRaw, toRaw string, now time.Time, fallback time.Duration) (time.Time, time.Time, error) {
	to, from := now, now.Add(-fallback)
	var err error
	if toRaw != "" {
		if to, err = time.Parse(time.RFC3339Nano, toRaw); err != nil {
			return from, to, bad("ts_out_of_range", "from/to must be RFC3339")
		}
	}
	if fromRaw != "" {
		if from, err = time.Parse(time.RFC3339Nano, fromRaw); err != nil {
			return from, to, bad("ts_out_of_range", "from/to must be RFC3339")
		}
	} else if toRaw != "" {
		from = to.Add(-fallback)
	}
	if !to.After(from) {
		return from, to, bad("ts_out_of_range", "from must be before to")
	}
	if to.Sub(from) > MaxRange {
		return from, to, bad("range_too_large", "max range is 92 days")
	}
	return from.UTC(), to.UTC(), nil
}

// Parse parses and validates q into an AST, as an invalid_query Error.
func Parse(q string) (*grammar.AST, error) {
	ast, err := grammar.Parse(q)
	if err == nil {
		err = grammar.Validate(ast, q)
	}
	var ge *grammar.Error
	if errors.As(err, &ge) {
		return nil, &Error{Code: "invalid_query", Message: ge.Message, Details: map[string]any{"position": ge.Position, "hint": ge.Hint}}
	}
	return ast, err
}

func compileErr(err error) error {
	var ce *compile.Error
	if errors.As(err, &ce) {
		return &Error{Code: "invalid_query", Message: ce.Message, Details: map[string]any{"position": 0}}
	}
	return err
}

type Point struct {
	TS    time.Time `json:"ts"`
	Value *float64  `json:"value"`
}

type Series struct {
	Name   string            `json:"name"`
	Tags   map[string]string `json:"tags"`
	Points []Point           `json:"points"`
}

type Timeseries struct {
	Kind   string   `json:"kind"`
	Series []Series `json:"series"`
	Step   string   `json:"step"`
}

type Table struct {
	Kind    string   `json:"kind"`
	Columns []string `json:"columns"`
	Rows    [][]any  `json:"rows"`
}

// QueryRequest is POST /v1/query.
type QueryRequest struct {
	Q      string `json:"q"`
	From   string `json:"from"`
	To     string `json:"to"`
	Step   string `json:"step"`
	Signal string `json:"signal"`
}

// maxGroups caps a series result's cardinality.
const maxGroups = 20

// Query runs the shared grammar: a timeseries with an aggregation, the raw
// stream as a table without one.
func (s *Service) Query(ctx context.Context, orgID string, req QueryRequest) (any, error) {
	if strings.TrimSpace(req.From) == "" || strings.TrimSpace(req.To) == "" {
		return nil, bad("bad_shape", "q, from and to are required")
	}
	from, to, err := Range(req.From, req.To, s.Now(), time.Hour)
	if err != nil {
		return nil, err
	}
	ast, err := Parse(req.Q)
	if err != nil {
		return nil, err
	}
	signal := compile.Detect(ast)
	if req.Signal != "" {
		signal = compile.Signal(req.Signal)
	}
	creq, err := s.request(ctx, orgID, ast, signal, from, to)
	if err != nil {
		return nil, err
	}
	if len(ast.Agg) == 0 {
		q, err := compile.Rows(creq)
		if err != nil {
			return nil, compileErr(err)
		}
		rows, err := s.CH.Rows(ctx, orgID, q.SQL, q.Params)
		if err != nil {
			return nil, err
		}
		return table(rows), nil
	}
	return s.series(ctx, orgID, creq)
}

// request resolves the step, tier and metric kind for a compiled query.
func (s *Service) request(ctx context.Context, orgID string, ast *grammar.AST, signal compile.Signal, from, to time.Time) (compile.Request, error) {
	tier := compile.Raw
	if signal == compile.Metrics {
		tier = compile.TierFor(from, to)
	}
	step, err := compile.Step(ast.Step, from, to, tier)
	if err != nil {
		return compile.Request{}, bad("invalid_query", err.Error())
	}
	req := compile.Request{AST: ast, Signal: signal, OrgID: orgID, From: from, To: to, Step: step, Tier: tier}
	if s.Monitors != nil {
		req.Monitors = s.Monitors(orgID)
	}
	if signal == compile.Metrics {
		if name, ok := grammar.FacetValue(ast, "metric"); ok {
			rows, err := s.CH.Rows(ctx, orgID, `SELECT 1 FROM otel_metrics_histogram WHERE org_id = {o:String} AND MetricName = {m:String} LIMIT 1`,
				map[string]string{"o": orgID, "m": name})
			if err != nil {
				return req, err
			}
			req.Histogram = len(rows) > 0
		}
	}
	return req, nil
}

func (s *Service) series(ctx context.Context, orgID string, req compile.Request) (*Timeseries, error) {
	q, err := compile.Series(req)
	if err != nil {
		return nil, compileErr(err)
	}
	rows, err := s.CH.Rows(ctx, orgID, q.SQL, q.Params)
	if err != nil {
		return nil, err
	}
	return Assemble(rows, q, req.From, req.To, req.Step), nil
}

// Assemble turns rows (t, g0.., a0..) into named series over every bucket;
// a bucket with no row is a null point, never a zero.
func Assemble(rows []map[string]any, q *compile.Query, from, to time.Time, step time.Duration) *Timeseries {
	type key struct{ agg, group string }
	type acc struct {
		tags   map[string]string
		points map[int64]float64
		total  float64
	}
	series := map[key]*acc{}
	for _, row := range rows {
		t := chdb.Time(row["t"]).Unix()
		tags := map[string]string{}
		var parts []string
		for i, g := range q.Groups {
			v := chdb.Str(row[fmt.Sprintf("g%d", i)])
			tags[g] = v
			parts = append(parts, g+":"+v)
		}
		group := strings.Join(parts, " ")
		for i := range q.Aggs {
			v, ok := chdb.Float(row[fmt.Sprintf("a%d", i)])
			if !ok {
				continue
			}
			k := key{agg: fmt.Sprint(i), group: group}
			if series[k] == nil {
				series[k] = &acc{tags: tags, points: map[int64]float64{}}
			}
			series[k].points[t] = v
			series[k].total += v
		}
	}
	keys := make([]key, 0, len(series))
	for k := range series {
		keys = append(keys, k)
	}
	sort.Slice(keys, func(i, j int) bool {
		if series[keys[i]].total != series[keys[j]].total {
			return series[keys[i]].total > series[keys[j]].total
		}
		return keys[i].group < keys[j].group
	})
	start := from.Truncate(step)
	out := &Timeseries{Kind: "timeseries", Series: []Series{}, Step: stepLabel(step)}
	for n, k := range keys {
		if n >= maxGroups*len(q.Aggs) {
			break
		}
		a := q.Aggs[atoi(k.agg)]
		name := a.Fn + "(" + a.Field + ")"
		if k.group != "" {
			name += " " + k.group
		}
		sr := Series{Name: name, Tags: series[k].tags, Points: []Point{}}
		for b := start; b.Before(to); b = b.Add(step) {
			p := Point{TS: b}
			if v, ok := series[k].points[b.Unix()]; ok {
				p.Value = &v
			}
			sr.Points = append(sr.Points, p)
		}
		out.Series = append(out.Series, sr)
	}
	return out
}

func atoi(s string) int {
	n := 0
	for _, c := range s {
		n = n*10 + int(c-'0')
	}
	return n
}

func stepLabel(d time.Duration) string {
	switch {
	case d%(24*time.Hour) == 0:
		return fmt.Sprintf("%dd", int(d/(24*time.Hour)))
	case d%time.Hour == 0:
		return fmt.Sprintf("%dh", int(d/time.Hour))
	case d%time.Minute == 0:
		return fmt.Sprintf("%dm", int(d/time.Minute))
	}
	return fmt.Sprintf("%ds", int(d/time.Second))
}

func table(rows []map[string]any) *Table {
	t := &Table{Kind: "table", Columns: []string{}, Rows: [][]any{}}
	if len(rows) == 0 {
		return t
	}
	for c := range rows[0] {
		t.Columns = append(t.Columns, c)
	}
	sort.Strings(t.Columns)
	for _, row := range rows {
		r := make([]any, len(t.Columns))
		for i, c := range t.Columns {
			r[i] = row[c]
		}
		t.Rows = append(t.Rows, r)
	}
	return t
}

// ── MI-9 replay ─────────────────────────────────────────────────────────

// ReplayRequest re-evaluates a rule's query over the last 24 h.
type ReplayRequest struct {
	Signal          string     `json:"signal"`
	MonitorID       string     `json:"monitor_id"`
	QueryString     string     `json:"query_string"`
	Thresholds      Thresholds `json:"thresholds"`
	CooldownMinutes int        `json:"cooldown_minutes"`
}

type Thresholds struct {
	Warn   *float64 `json:"warn"`
	Crit   float64  `json:"crit"`
	Window string   `json:"window"`
}

type Band struct {
	Level string    `json:"level"`
	From  time.Time `json:"from"`
	To    time.Time `json:"to"`
}

type Replay struct {
	QueryString    string      `json:"query_string"`
	Thresholds     Thresholds  `json:"thresholds"`
	Series         []Series    `json:"series"`
	Step           string      `json:"step"`
	Bands          []Band      `json:"bands"`
	Markers        []time.Time `json:"markers"`
	WouldHaveFired int         `json:"would_have_fired"`
}

// Replay runs the query over 24 h at 5-minute steps and marks where the
// thresholds were crossed: contiguous breaches are bands, crit-band starts
// are would-have-fired markers, de-gated by the cooldown.
func (s *Service) Replay(ctx context.Context, orgID string, req ReplayRequest) (*Replay, error) {
	ast, err := Parse(req.QueryString)
	if err != nil {
		return nil, err
	}
	if len(ast.Agg) == 0 {
		ast.Agg = []grammar.Agg{{Fn: "count"}}
	}
	ast.Step = "5m"
	now := s.Now().UTC()
	from := now.Add(-24 * time.Hour)
	creq, err := s.request(ctx, orgID, ast, compile.Detect(ast), from, now)
	if err != nil {
		return nil, err
	}
	ts, err := s.series(ctx, orgID, creq)
	if err != nil {
		return nil, err
	}
	out := &Replay{QueryString: req.QueryString, Thresholds: req.Thresholds, Series: ts.Series, Step: ts.Step,
		Bands: []Band{}, Markers: []time.Time{}}
	if len(ts.Series) == 0 {
		return out, nil
	}
	out.Bands, out.Markers = Bands(ts.Series[0].Points, creq.Step, req.Thresholds, time.Duration(req.CooldownMinutes)*time.Minute)
	out.WouldHaveFired = len(out.Markers)
	return out, nil
}

// Bands finds threshold breaches in points (exported for tests).
func Bands(points []Point, step time.Duration, th Thresholds, cooldown time.Duration) ([]Band, []time.Time) {
	level := func(p Point) string {
		switch {
		case p.Value == nil:
			return ""
		case *p.Value >= th.Crit:
			return "crit"
		case th.Warn != nil && *p.Value >= *th.Warn:
			return "warn"
		}
		return ""
	}
	bands := []Band{}
	markers := []time.Time{}
	var last time.Time
	for i := 0; i < len(points); {
		l := level(points[i])
		if l == "" {
			i++
			continue
		}
		j := i
		for j+1 < len(points) && level(points[j+1]) == l {
			j++
		}
		bands = append(bands, Band{Level: l, From: points[i].TS, To: points[j].TS.Add(step)})
		if l == "crit" && (last.IsZero() || points[i].TS.Sub(last) >= cooldown) {
			markers = append(markers, points[i].TS)
			last = points[i].TS
		}
		i = j + 1
	}
	return bands, markers
}
