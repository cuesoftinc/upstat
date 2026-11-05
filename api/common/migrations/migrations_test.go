package migrations

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"regexp"
	"strings"
	"sync"
	"testing"

	"github.com/cuesoftinc/upstat/api/common/pkg/testenv"
)

func TestStatementsSplitOnTerminators(t *testing.T) {
	got := Statements("-- comment\nCREATE TABLE a (x UInt8)\nENGINE = Memory;\n\nSELECT 1;\n")
	if len(got) != 2 || !strings.HasPrefix(got[0], "CREATE TABLE a") || got[1] != "SELECT 1" {
		t.Fatalf("statements = %q", got)
	}
}

// TestClickHouseApplies runs the telemetry migrations against a real
// ClickHouse (CLICKHOUSE_TEST_URL, e.g. http://localhost:8123/?database=upstat),
// twice: the second pass must be a no-op.
func TestClickHouseApplies(t *testing.T) {
	url := testenv.Require(t, "CLICKHOUSE_TEST_URL")
	ch := ClickHouse{URL: url, User: os.Getenv("CLICKHOUSE_TEST_USER"), Password: os.Getenv("CLICKHOUSE_TEST_PASSWORD")}
	for range 2 {
		if err := ch.Apply(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
}

// tenantTables lists the tables the ClickHouse migrations give an org_id
// column: those created with one, and those that gain one later.
func tenantTables(t *testing.T) []string {
	t.Helper()
	create := regexp.MustCompile(`(?s)CREATE TABLE IF NOT EXISTS (\w+)\s*\((.*?)\n\)\s*\nENGINE`)
	add := regexp.MustCompile(`ALTER TABLE (\w+) ADD COLUMN IF NOT EXISTS org_id`)
	names, err := sorted("clickhouse")
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, name := range names {
		raw, err := files.ReadFile(name)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range create.FindAllStringSubmatch(string(raw), -1) {
			if strings.Contains(m[2], "org_id") {
				out = append(out, m[1])
			}
		}
		for _, m := range add.FindAllStringSubmatch(string(raw), -1) {
			out = append(out, m[1])
		}
	}
	return out
}

func TestEveryTenantTableHasARowPolicy(t *testing.T) {
	tables := tenantTables(t)
	if len(tables) < 16 {
		t.Fatalf("found %d tenant tables, want at least 16: %v", len(tables), tables)
	}
	raw, err := files.ReadFile("clickhouse/0003_row_policies.sql")
	if err != nil {
		t.Fatal(err)
	}
	policy := string(raw)
	for _, table := range tables {
		if !regexp.MustCompile(`[\s,]` + table + `[\s,]`).MatchString(policy) {
			t.Errorf("table %s has an org_id column and no row policy", table)
		}
	}
	for _, want := range []string{"USING org_id = getSetting('SQL_upstat_org')", "TO " + queryUserToken} {
		if !strings.Contains(policy, want) {
			t.Errorf("policy lacks %q", want)
		}
	}
}

// fakeClickHouse records every statement and answers the migration runner's
// own lookups.
type fakeClickHouse struct {
	mu         sync.Mutex
	statements []string
	userCount  string
}

func (f *fakeClickHouse) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body, _ := io.ReadAll(r.Body)
	stmt := strings.TrimSpace(string(body))
	f.mu.Lock()
	f.statements = append(f.statements, stmt)
	f.mu.Unlock()
	switch {
	case strings.HasPrefix(stmt, "SELECT count() FROM schema_migration"):
		_, _ = w.Write([]byte("0\n"))
	case strings.HasPrefix(stmt, "SELECT count() FROM system.users"):
		_, _ = w.Write([]byte(f.userCount + "\n"))
	}
}

func (f *fakeClickHouse) saw(substr string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, s := range f.statements {
		if strings.Contains(s, substr) {
			return true
		}
	}
	return false
}

func TestRowPoliciesBindToTheQueryUser(t *testing.T) {
	fake := &fakeClickHouse{userCount: "1"}
	srv := httptest.NewServer(fake)
	defer srv.Close()
	if err := (ClickHouse{URL: srv.URL, QueryUser: "query_ro"}).Apply(context.Background()); err != nil {
		t.Fatal(err)
	}
	if !fake.saw("CREATE ROW POLICY IF NOT EXISTS org ON otel_logs") || !fake.saw("TO query_ro") || fake.saw(queryUserToken) {
		t.Fatalf("the policy was not applied for query_ro: %q", fake.statements)
	}
	if !fake.saw("INSERT INTO schema_migration (version) VALUES ('clickhouse/0003_row_policies.sql')") {
		t.Fatal("0003 was not recorded")
	}
}

func TestRowPoliciesFailClosedWhenTheUserIsMissing(t *testing.T) {
	fake := &fakeClickHouse{userCount: "0"}
	srv := httptest.NewServer(fake)
	defer srv.Close()
	err := (ClickHouse{URL: srv.URL, QueryUser: "query_ro"}).Apply(context.Background())
	if err == nil || !strings.Contains(err.Error(), "does not exist") {
		t.Fatalf("err = %v, want a missing-user error", err)
	}
	if fake.saw("CREATE ROW POLICY") || fake.saw("'clickhouse/0003_row_policies.sql')") {
		t.Fatal("a policy was applied or recorded for a user that does not exist")
	}
}

func TestRowPoliciesWaitForAQueryUser(t *testing.T) {
	fake := &fakeClickHouse{userCount: "1"}
	srv := httptest.NewServer(fake)
	defer srv.Close()
	if err := (ClickHouse{URL: srv.URL}).Apply(context.Background()); err != nil {
		t.Fatal(err)
	}
	if fake.saw("CREATE ROW POLICY") || fake.saw("'clickhouse/0003_row_policies.sql')") {
		t.Fatal("without a query user the policy file must be left unapplied and unrecorded")
	}
}

func TestQueryUserMustBeAPlainName(t *testing.T) {
	fake := &fakeClickHouse{userCount: "1"}
	srv := httptest.NewServer(fake)
	defer srv.Close()
	if err := (ClickHouse{URL: srv.URL, QueryUser: "ro; DROP TABLE x"}).Apply(context.Background()); err == nil {
		t.Fatal("an unsafe user name must be refused")
	}
}
