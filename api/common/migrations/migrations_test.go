package migrations

import (
	"context"
	"os"
	"strings"
	"testing"
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
	url := os.Getenv("CLICKHOUSE_TEST_URL")
	if url == "" {
		t.Skip("CLICKHOUSE_TEST_URL not set")
	}
	ch := ClickHouse{URL: url, User: os.Getenv("CLICKHOUSE_TEST_USER"), Password: os.Getenv("CLICKHOUSE_TEST_PASSWORD")}
	for range 2 {
		if err := ch.Apply(context.Background()); err != nil {
			t.Fatal(err)
		}
	}
}
