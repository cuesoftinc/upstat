package telemetry

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
)

// These tests need no ClickHouse: a recording Reader stands in and the SQL
// and parameters it received are the subject.

type call struct {
	org, sql string
	params   map[string]string
}

type recorder struct {
	mu    sync.Mutex
	calls []call
}

func (r *recorder) Rows(_ context.Context, orgID, sql string, params map[string]string) ([]map[string]any, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls = append(r.calls, call{orgID, sql, params})
	return nil, nil
}

func recorded() (*Service, *recorder) {
	r := &recorder{}
	return &Service{CH: r, Now: func() time.Time { return time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC) }}, r
}

func TestQueryStepIsHonoured(t *testing.T) {
	s, _ := recorded()
	req := QueryRequest{Q: "service:web | count()", From: "2026-11-05T06:00:00Z", To: "2026-11-05T12:00:00Z", Step: "5m"}
	res, err := s.Query(context.Background(), org, req)
	if err != nil {
		t.Fatal(err)
	}
	if got := res.(*Timeseries).Step; got != "5m" {
		t.Fatalf("step = %q, want 5m", got)
	}
	req.Step = "30m"
	res, err = s.Query(context.Background(), org, req)
	if err != nil {
		t.Fatal(err)
	}
	if got := res.(*Timeseries).Step; got != "30m" {
		t.Fatalf("step = %q, want 30m", got)
	}
}

func TestQueryRejectsABadStep(t *testing.T) {
	s, _ := recorded()
	for _, step := range []string{"bogus", "1s"} {
		_, err := s.Query(context.Background(), org, QueryRequest{Q: "service:web | count()", From: "2026-11-05T06:00:00Z", To: "2026-11-05T12:00:00Z", Step: step})
		var e *Error
		if !errors.As(err, &e) || e.Code != "invalid_query" {
			t.Fatalf("step %q: err = %v, want invalid_query", step, err)
		}
	}
}

func TestUptimeIDsTravelAsAParameter(t *testing.T) {
	s, r := recorded()
	ids := []string{"m1", "x') OR 1=1 --"}
	if _, err := s.Uptime(context.Background(), org, ids, 7); err != nil {
		t.Fatal(err)
	}
	if len(r.calls) != 2 {
		t.Fatalf("calls = %d, want 2", len(r.calls))
	}
	for _, c := range r.calls {
		if strings.Contains(c.sql, "1=1") || strings.Contains(c.sql, "m1") {
			t.Fatalf("an id is in the SQL text:\n%s", c.sql)
		}
		if c.params["ids"] != chdb.ArrayParam(ids) {
			t.Fatalf("ids param = %q", c.params["ids"])
		}
	}
}

func TestTraceWindowLookupIsOrgScoped(t *testing.T) {
	s, r := recorded()
	if _, err := s.Trace(context.Background(), org, strings.Repeat("a", 32)); err != nil {
		t.Fatal(err)
	}
	first := r.calls[0]
	if !strings.Contains(first.sql, "otel_traces_trace_id_ts") || !strings.Contains(first.sql, "org_id = {o:String}") || first.params["o"] != org {
		t.Fatalf("window lookup is not org scoped: %s %v", first.sql, first.params)
	}
}
