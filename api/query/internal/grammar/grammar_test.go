package grammar

import (
	"encoding/json"
	"errors"
	"testing"
)

// The grammar corpus (engineering.md §6: 30+ valid, 30+ invalid, with exact
// error positions).

var valid = []string{
	"",
	"service:api-common",
	"service:api-common status:error",
	"service:api-common | count() by level",
	"metric:http.request.duration_ms service:web | p95() by path",
	"-level:debug (service:web OR service:worker) timeout",
	"check:homepage | rate()",
	"timeout",
	`"connection reset"`,
	`service:"my service"`,
	`@user_tier:pro`,
	"trace.duration_ms:>250",
	"trace.duration_ms:>=250 service:web",
	"trace.duration_ms:<10",
	"trace.duration_ms:<=10",
	"trace.duration_ms:=99",
	"(a OR (b c)) -d",
	"service:web | count(), p95(trace.duration_ms) by service, env",
	"service:web | rate()",
	"rum.path:/pricing | count() by rum.country",
	"rum.vital.lcp:>2500 | p95(rum.vital.lcp)",
	"level:ERROR",
	"| count()",
	"metric:cpu.usage | avg() by host",
	"metric:cpu.usage | max(), min()",
	"service:web | uniq(@user_id)",
	"service:web | sum(@bytes) by @route",
	"env:prod host:web-1 level:warn",
	`"a \"quoted\" phrase"`,
	"-(service:a OR service:b)",
	"check:homepage region:us-east4 | p95(response_time_ms)",
	"(service:a service:b OR service:c)",
	"metric.region:eu | count()",
}

var invalid = []struct {
	q   string
	pos int
}{
	{"bogus:x", 0},
	{"service:web bogus:x", 12},
	{"service:", 8},
	{"service:web |", 13},
	{"service:web | ", 14},
	{"service:web | nonsense()", 14},
	{"service:web | count", 19},
	{"service:web | count(", 20},
	{"service:web | count() | rate()", 22},
	{"service:web | count() garbage", 22},
	{"(service:web", 0},
	{"service:web)", 11},
	{"()", 1},
	{"(service:a OR)", 13},
	{`"unterminated`, 0},
	{`service:"open`, 8},
	{"service:>5", 0},
	{"level:<3", 0},
	{"trace.duration_ms:>abc", 19},
	{"service:web | p95()", 14},
	{"service:web | sum()", 14},
	{"service:web | uniq()", 14},
	{"- service:web", 1},
	{"Service:web", 0},
	{"service:web | count() by", 24},
	{"service:web | count() by ,", 25},
	{"service:web | p95(trace.duration_ms) by", 39},
	{"service:web | count(nope)", 20},
	{"x | |", 4},
	{"service:web |count() ||", 21},
	{"(a OR OR b)", 6},
	{"env:", 4},
}

func parseAndValidate(q string) (*AST, error) {
	ast, err := Parse(q)
	if err != nil {
		return nil, err
	}
	return ast, Validate(ast, q)
}

func TestValidCorpus(t *testing.T) {
	for _, q := range valid {
		if _, err := parseAndValidate(q); err != nil {
			t.Errorf("%q: %v", q, err)
		}
	}
	if len(valid) < 30 {
		t.Fatalf("corpus has %d valid queries; the standard asks for 30+", len(valid))
	}
}

func TestInvalidCorpus(t *testing.T) {
	for _, tc := range invalid {
		_, err := parseAndValidate(tc.q)
		var qe *Error
		if !errors.As(err, &qe) {
			t.Errorf("%q: expected invalid_query, got %v", tc.q, err)
			continue
		}
		if qe.Position != tc.pos {
			t.Errorf("%q: position %d (%s), want %d", tc.q, qe.Position, qe.Message, tc.pos)
		}
	}
	if len(invalid) < 30 {
		t.Fatalf("corpus has %d invalid queries; the standard asks for 30+", len(invalid))
	}
}

func TestASTMatchesTheDocumentedShape(t *testing.T) {
	ast, err := Parse(`service:api-common (level:error OR level:warn) trace.duration_ms:>250 -level:debug timeout | p95(trace.duration_ms) by path`)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := json.Marshal(ast)
	want := `{"v":1,"filters":{"op":"and","terms":[{"facet":"service","cmp":"eq","value":"api-common"},` +
		`{"op":"or","terms":[{"facet":"level","cmp":"eq","value":"error"},{"facet":"level","cmp":"eq","value":"warn"}]},` +
		`{"facet":"trace.duration_ms","cmp":"gt","value":250},{"not":{"facet":"level","cmp":"eq","value":"debug"}},` +
		`{"text":"timeout"}]},"agg":[{"fn":"p95","field":"trace.duration_ms"}],"group_by":["path"],"step":"auto"}`
	if string(raw) != want {
		t.Fatalf("ast\n got %s\nwant %s", raw, want)
	}
}
