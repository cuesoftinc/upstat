package compile

import (
	"regexp"
	"strings"
	"testing"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/grammar"
)

var hostile = []string{
	`x' OR '1'='1`,
	`x\' OR 1=1 --`,
	`'; DROP TABLE otel_logs; --`,
	"x\x00y",
	`") OR org_id != ("`,
	`a%' UNION SELECT * FROM otel_traces --`,
}

var placeholder = regexp.MustCompile(`\{(p\d+):[A-Za-z0-9()]+\}`)

func request(signal Signal, ast *grammar.AST) Request {
	to := time.Date(2026, 11, 5, 12, 0, 0, 0, time.UTC)
	return Request{AST: ast, Signal: signal, OrgID: "11111111-1111-4111-8111-111111111111", From: to.Add(-time.Hour), To: to,
		Step: time.Minute, Tier: Raw, Monitors: map[string]string{"home": "m1"}}
}

// assertParameterised fails when a hostile value reaches the SQL text, or a
// placeholder has no parameter behind it.
func assertParameterised(t *testing.T, q *Query, values ...string) {
	t.Helper()
	for _, v := range values {
		if strings.Contains(q.SQL, v) {
			t.Fatalf("value %q is in the SQL text:\n%s", v, q.SQL)
		}
		found := false
		for _, p := range q.Params {
			found = found || p == v
		}
		if !found {
			t.Fatalf("value %q is not a parameter: %v", v, q.Params)
		}
	}
	for _, m := range placeholder.FindAllStringSubmatch(q.SQL, -1) {
		if _, ok := q.Params[m[1]]; !ok {
			t.Fatalf("placeholder %s has no parameter:\n%s", m[0], q.SQL)
		}
	}
}

func TestEveryValueTravelsAsAParameter(t *testing.T) {
	for _, signal := range []Signal{Logs, Traces, Events, Metrics} {
		for _, h := range hostile {
			ast := &grammar.AST{V: 1, Step: "auto", Agg: []grammar.Agg{{Fn: "count"}},
				Filters: grammar.Group{Op: "and", Terms: []grammar.Term{
					{Text: &h},
					{Facet: "@attr", Cmp: "eq", Value: h},
					{Facet: "metric", Cmp: "eq", Value: h},
				}}}
			if signal == Traces {
				ast.Filters.Terms = append(ast.Filters.Terms, grammar.Term{Facet: "trace.custom", Cmp: "eq", Value: h})
			}
			if signal == Events {
				ast.Filters.Terms = append(ast.Filters.Terms, grammar.Term{Facet: "rum.vital.lcp", Cmp: "gt", Value: float64(1)})
			}
			req := request(signal, ast)
			series, err := Series(req)
			if err != nil {
				t.Fatalf("%s series: %v", signal, err)
			}
			assertParameterised(t, series, h)
			rows, err := Rows(req)
			if err != nil {
				t.Fatalf("%s rows: %v", signal, err)
			}
			assertParameterised(t, rows, h)
		}
	}
}

func TestParsedHostileQueriesStayParameters(t *testing.T) {
	for _, q := range []string{
		`service:"x' OR '1'='1" | count()`,
		`"'; DROP TABLE otel_logs; --"`,
		`@k:"a\\' OR 1=1 --" | count() by @k`,
		`level:"x') OR (1=1"`,
	} {
		ast, err := grammar.Parse(q)
		if err != nil {
			t.Fatalf("%q: %v", q, err)
		}
		out, err := Rows(request(Logs, ast))
		if err != nil {
			t.Fatalf("%q: %v", q, err)
		}
		for _, bad := range []string{"DROP TABLE", "OR '1'='1", "1=1"} {
			if strings.Contains(out.SQL, bad) {
				t.Fatalf("%q leaked %q into SQL:\n%s", q, bad, out.SQL)
			}
		}
		assertParameterised(t, out)
	}
}

func TestOrgPredicateIsAlwaysInjected(t *testing.T) {
	ast := &grammar.AST{V: 1, Step: "auto", Filters: grammar.Group{Op: "or", Terms: []grammar.Term{{Facet: "service", Cmp: "eq", Value: "a"}}}}
	for _, signal := range []Signal{Logs, Traces, Events, Metrics, Checks} {
		w, params, err := Where(request(signal, ast))
		if signal == Checks || signal == Events {
			if err == nil {
				t.Fatalf("%s: service filter accepted, want invalid_query", signal)
			}
			continue // service does not apply to checks or events
		}
		if err != nil {
			t.Fatalf("%s: %v", signal, err)
		}
		if !strings.HasPrefix(w, "org_id = {p1:String}") || params["p1"] != "11111111-1111-4111-8111-111111111111" {
			t.Fatalf("%s: where = %s params = %v", signal, w, params)
		}
	}
}

func TestUnknownComparatorIsInvalid(t *testing.T) {
	for _, term := range []grammar.Term{
		{Facet: "trace.duration_ms", Cmp: "> 0 OR 1=1 --", Value: float64(1)},
		{Facet: "rum.vital.lcp", Cmp: "bogus", Value: float64(1)},
	} {
		signal := Traces
		if strings.HasPrefix(term.Facet, "rum.") {
			signal = Events
		}
		ast := &grammar.AST{V: 1, Step: "auto", Filters: grammar.Group{Op: "and", Terms: []grammar.Term{term}}}
		_, err := Rows(request(signal, ast))
		if _, ok := err.(*Error); !ok {
			t.Fatalf("%s %q: err = %v, want a compile error", term.Facet, term.Cmp, err)
		}
	}
}

func TestStepHonoursTheRequestedSpec(t *testing.T) {
	from := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC)
	to := from.Add(6 * time.Hour)
	if got, err := Step("5m", from, to, Raw); err != nil || got != 5*time.Minute {
		t.Fatalf("step 5m = %v, %v", got, err)
	}
	if _, err := Step("1s", from, to, Raw); err == nil {
		t.Fatal("a step with more than 2000 buckets must be rejected")
	}
	if _, err := Step("1m; DROP", from, to, Raw); err == nil {
		t.Fatal("a non-duration step must be rejected")
	}
}
