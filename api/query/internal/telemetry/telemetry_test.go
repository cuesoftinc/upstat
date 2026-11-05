package telemetry

import (
	"context"
	"fmt"
	"math/rand"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/common/migrations"
	"github.com/cuesoftinc/upstat/api/common/pkg/testenv"
	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
)

// These tests run against a real ClickHouse (CLICKHOUSE_TEST_URL, e.g.
// http://localhost:8123/), in a fresh database with api/common's
// migrations applied, and seed rows the way the collector writes them.

const org, other = "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"

func setup(t *testing.T) (*Service, *chdb.Client, time.Time) {
	t.Helper()
	base := testenv.Require(t, "CLICKHOUSE_TEST_URL")
	user, pass := os.Getenv("CLICKHOUSE_TEST_USER"), os.Getenv("CLICKHOUSE_TEST_PASSWORD")
	db := fmt.Sprintf("upstat_test_%d", rand.Int63())
	admin := chdb.New(base, user, pass)
	ctx := context.Background()
	if _, err := admin.Rows(ctx, "", "CREATE DATABASE "+db, nil); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = admin.Rows(context.Background(), "", "DROP DATABASE "+db, nil) })
	u, _ := url.Parse(base)
	qv := u.Query()
	qv.Set("database", db)
	u.RawQuery = qv.Encode()
	if err := (migrations.ClickHouse{URL: u.String(), User: user, Password: pass}).Apply(ctx); err != nil {
		t.Fatal(err)
	}
	ch := chdb.New(u.String(), user, pass)
	now := time.Now().UTC().Truncate(time.Second)
	seed(t, ch, now)
	return &Service{CH: ch, Now: func() time.Time { return now },
		Monitors: func(o string) map[string]string {
			return map[string]string{"homepage": "mon-1", "mon-1": "mon-1"}
		}}, ch, now
}

func exec(t *testing.T, ch *chdb.Client, sql string) {
	t.Helper()
	if _, err := ch.Rows(context.Background(), "", sql, nil); err != nil {
		t.Fatalf("%v\n%s", err, sql)
	}
}

func at(now time.Time, ago time.Duration) string {
	return now.Add(-ago).Format("2006-01-02 15:04:05.000")
}

func seed(t *testing.T, ch *chdb.Client, now time.Time) {
	var logs []string
	for i := range 30 {
		lvl := "INFO"
		if i%3 == 0 {
			lvl = "ERROR"
		}
		logs = append(logs, fmt.Sprintf("('%s', '%s', 'api', 'payment timeout for order %d', map('upstat.org_id', '%s', 'host.name', 'web-1'), map('user', 'u%d'))",
			at(now, time.Duration(i)*time.Minute), lvl, i, org, i))
	}
	logs = append(logs, fmt.Sprintf("('%s', 'ERROR', 'api', 'secret of another org', map('upstat.org_id', '%s'), map())", at(now, time.Minute), other))
	exec(t, ch, "INSERT INTO otel_logs (Timestamp, SeverityText, ServiceName, Body, ResourceAttributes, LogAttributes) VALUES "+strings.Join(logs, ","))

	var spans []string
	for i := range 10 {
		status := "Ok"
		if i == 0 {
			status = "Error"
		}
		trace := fmt.Sprintf("%032x", i+1)
		spans = append(spans,
			fmt.Sprintf("('%s', '%s', 'a%015x', '', 'GET /cart', 'Server', 'shop', map('upstat.org_id', '%s'), %d, '%s')",
				at(now, time.Duration(i)*time.Minute), trace, i, org, (100+i*100)*1_000_000, status),
			fmt.Sprintf("('%s', '%s', 'b%015x', 'a%015x', 'SELECT cart', 'Client', 'db', map('upstat.org_id', '%s'), 5000000, 'Ok')",
				at(now, time.Duration(i)*time.Minute), trace, i, i, org))
	}
	exec(t, ch, "INSERT INTO otel_traces (Timestamp, TraceId, SpanId, ParentSpanId, SpanName, SpanKind, ServiceName, ResourceAttributes, Duration, StatusCode) VALUES "+
		strings.Join(spans, ","))

	var checks []string
	for i := range 20 {
		ok := "true"
		if i < 5 {
			ok = "false"
		}
		checks = append(checks, fmt.Sprintf("('%s', 'upstat.checks', map('upstat.org_id', '%s'), map('upstat.kind', 'check_result', 'monitor_id', 'mon-1', 'tick_id', 't%d', 'region', 'us-central1', 'ok', '%s', 'total_ms', '%d', 'status_code', '200', 'scheduled_at', '%s'))",
			at(now, time.Duration(i)*time.Minute), org, i, ok, 100+i, now.Add(-time.Duration(i)*time.Minute).Format(time.RFC3339)))
	}
	exec(t, ch, "INSERT INTO otel_logs (Timestamp, ServiceName, ResourceAttributes, LogAttributes) VALUES "+strings.Join(checks, ","))

	var events []string
	add := func(ago time.Duration, name, visitor, path string, value float64, extra string) {
		events = append(events, fmt.Sprintf("('%s', 'upstat.events', map('upstat.org_id', '%s'), map('upstat.kind', 'event', 'property_id', 'prop-1', 'name', '%s', 'visitor_hash', '%s', 'path', '%s', 'device_class', 'desktop', 'country', 'NG', 'value', '%g'%s))",
			at(now, ago), org, name, visitor, path, value, extra))
	}
	add(50*time.Minute, "page_view", "v1", "/", 0, "")
	add(45*time.Minute, "page_view", "v1", "/pricing", 0, "")
	add(40*time.Minute, "signup", "v1", "/pricing", 0, "")
	add(30*time.Minute, "page_view", "v2", "/", 0, "")
	add(10*time.Minute, "web_vital", "v2", "/", 2400, ", 'dim.metric', 'lcp'")
	add(5*time.Minute, "js_error", "v2", "/", 0, ", 'dim.fingerprint', 'fp1', 'dim.message', 'x is undefined'")
	exec(t, ch, "INSERT INTO otel_logs (Timestamp, ServiceName, ResourceAttributes, LogAttributes) VALUES "+strings.Join(events, ","))

	exec(t, ch, fmt.Sprintf("INSERT INTO otel_logs (Timestamp, ServiceName, ResourceAttributes, LogAttributes) VALUES ('%s', 'upstat.usage', map('upstat.org_id', '%s'), map('upstat.kind', 'usage', 'pillar', 'logs', 'key_id', 'k1', 'bytes', '2500000', 'items', '31'))",
		at(now, time.Minute), org))
}

func TestQueryTimeseriesAndTenancy(t *testing.T) {
	s, _, now := setup(t)
	ctx := context.Background()
	out, err := s.Query(ctx, org, QueryRequest{Q: "service:api | count() by level", From: now.Add(-time.Hour).Format(time.RFC3339), To: now.Add(time.Minute).Format(time.RFC3339)})
	if err != nil {
		t.Fatal(err)
	}
	ts := out.(*Timeseries)
	var total float64
	for _, sr := range ts.Series {
		for _, p := range sr.Points {
			if p.Value != nil {
				total += *p.Value
			}
		}
	}
	if total != 30 || len(ts.Series) != 2 {
		t.Fatalf("series=%d total=%v (another org's line must not count)", len(ts.Series), total)
	}
	if _, err := s.Query(ctx, org, QueryRequest{Q: "bogus:x", From: now.Add(-time.Hour).Format(time.RFC3339), To: now.Format(time.RFC3339)}); err == nil ||
		!strings.Contains(err.Error(), "invalid_query") {
		t.Fatalf("unknown facet: %v", err)
	}
	p95, err := s.Query(ctx, org, QueryRequest{Q: "service:shop | p95(trace.duration_ms)", From: now.Add(-time.Hour).Format(time.RFC3339), To: now.Add(time.Minute).Format(time.RFC3339)})
	if err != nil || len(p95.(*Timeseries).Series) != 1 {
		t.Fatalf("p95: %v %+v", err, p95)
	}
	rate, err := s.Query(ctx, org, QueryRequest{Q: "check:homepage | rate()", From: now.Add(-time.Hour).Format(time.RFC3339), To: now.Add(time.Minute).Format(time.RFC3339), Step: "1h"})
	if err != nil {
		t.Fatal(err)
	}
	var sum, n float64
	for _, p := range rate.(*Timeseries).Series[0].Points {
		if p.Value != nil {
			sum += *p.Value
			n++
		}
	}
	if n == 0 || sum/n < 0.5 || sum/n > 1 {
		t.Fatalf("pass ratio %v over %v buckets", sum, n)
	}
}

func TestExplorers(t *testing.T) {
	s, _, now := setup(t)
	ctx := context.Background()
	page, err := s.Logs(ctx, org, LogParams{Q: "level:error", From: now.Add(-time.Hour).Format(time.RFC3339), To: now.Add(time.Minute).Format(time.RFC3339), Limit: 5})
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Events) != 5 || page.NextCursor == "" || page.Facets["service"][0].Value != "api" {
		t.Fatalf("logs page: %d events, cursor %q, facets %+v", len(page.Events), page.NextCursor, page.Facets)
	}
	pats, err := s.Patterns(ctx, org, "service:api", now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
	if err != nil || len(pats.Patterns) != 1 || pats.Patterns[0].Template != "payment timeout for order <num>" || pats.Patterns[0].Count != 30 {
		t.Fatalf("patterns: %v %+v", err, pats)
	}
	traces, err := s.Traces(ctx, org, "service:shop", now.Add(-time.Hour).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339), 50)
	if err != nil || len(traces) != 10 || traces[len(traces)-1].SpanCount != 2 {
		t.Fatalf("traces: %v %+v", err, traces)
	}
	tr, err := s.Trace(ctx, org, fmt.Sprintf("%032x", 1))
	if err != nil || tr == nil || len(tr.Spans) != 2 || tr.Status != "error" || tr.RootService != "shop" {
		t.Fatalf("trace: %v %+v", err, tr)
	}
	svcs, err := s.Services(ctx, org)
	if err != nil || len(svcs) != 1 || svcs[0].Service != "shop" || svcs[0].ErrorRate != 0.1 {
		t.Fatalf("services: %v %+v", err, svcs)
	}
}

func TestChecksRumStatsUsage(t *testing.T) {
	s, _, now := setup(t)
	ctx := context.Background()
	h, err := s.History(ctx, org, "mon-1")
	if err != nil || len(h.RecentChecks) != 20 || h.Uptime90dPct == nil || *h.Uptime90dPct != 75 || len(h.Days) < 90 {
		t.Fatalf("history: %v %+v", err, h)
	}
	up, err := s.Uptime(ctx, org, []string{"mon-1"}, 90)
	if err != nil || up["mon-1"].P95Ms == nil {
		t.Fatalf("uptime: %v %+v", err, up)
	}
	if has, err := s.HasData(ctx, org); err != nil || !has {
		t.Fatalf("has data: %v %v", has, err)
	}
	if has, _ := s.HasData(ctx, "33333333-3333-4333-8333-333333333333"); has {
		t.Fatal("an empty org has data")
	}
	sum, err := s.RumSummary(ctx, org, "", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
	if err != nil || sum.PageViews != 3 || sum.Visits != 2 || sum.BounceRate == nil || *sum.BounceRate != 0.5 {
		t.Fatalf("rum: %v %+v", err, sum)
	}
	vit, err := s.Vitals(ctx, org, "", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
	if err != nil || vit.LCPMs.P50 != 2400 {
		t.Fatalf("vitals: %v %+v", err, vit)
	}
	errs, err := s.Errors(ctx, org)
	if err != nil || len(errs) != 1 || errs[0].State != "new" {
		t.Fatalf("errors: %v %+v", err, errs)
	}
	st, err := s.Stats(ctx, org, "prop-1", "page_view", "hour", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(time.Hour).Format(time.RFC3339), "path")
	if err != nil || st.Totals.Count != 3 || st.UniquesAdditive || len(st.ByDim) != 2 {
		t.Fatalf("stats: %v %+v", err, st)
	}
	dd, err := s.Drilldown(ctx, org, "", "signup", now.Add(-2*time.Hour).Format(time.RFC3339), now.Add(time.Minute).Format(time.RFC3339))
	if err != nil || dd.Funnel.Stages[2].Count != 1 {
		t.Fatalf("drilldown: %v %+v", err, dd)
	}
	usage, err := s.Usage(ctx, org, time.UTC)
	if err != nil || usage.Rows[1].Value != 2500000 || usage.Rows[1].Display != "2.5 MB" {
		t.Fatalf("usage: %v %+v", err, usage)
	}
}

func TestReplayBands(t *testing.T) {
	v := func(f float64) *float64 { return &f }
	base := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	step := 5 * time.Minute
	vals := []*float64{v(1), v(9), v(12), v(12), v(1), v(12), nil, v(15)}
	var pts []Point
	for i, x := range vals {
		pts = append(pts, Point{TS: base.Add(time.Duration(i) * step), Value: x})
	}
	warn := 8.0
	bands, markers := Bands(pts, step, Thresholds{Warn: &warn, Crit: 10}, 20*time.Minute)
	if len(bands) != 4 || bands[0].Level != "warn" || bands[1].Level != "crit" {
		t.Fatalf("bands %+v", bands)
	}
	// Crit at +10m fires; +25m is 15 minutes later, inside the 20-minute
	// cooldown, so it doesn't; +35m does.
	if len(markers) != 2 {
		t.Fatalf("markers %v", markers)
	}
}
