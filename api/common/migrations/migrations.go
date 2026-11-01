// Package migrations embeds the forward-only migrations of both stores Go
// owns (D3): postgres/ (the control plane) and clickhouse/ (the telemetry
// plane). Each runs in file-name order, once.
package migrations

import (
	"bytes"
	"context"
	"embed"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed postgres/*.sql clickhouse/*.sql
var files embed.FS

// lockID is an arbitrary constant shared by every instance of this service.
const lockID = 7_242_031_101

// Apply runs the Postgres migrations under an advisory lock so concurrent
// instances don't race.
func Apply(ctx context.Context, pool *pgxpool.Pool) error {
	conn, err := pool.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, lockID); err != nil {
		return err
	}
	defer conn.Exec(context.Background(), `SELECT pg_advisory_unlock($1)`, lockID) //nolint:errcheck // released with the session anyway

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migration (
		version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	names, err := sorted("postgres")
	if err != nil {
		return err
	}
	for _, name := range names {
		var applied bool
		if err := conn.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migration WHERE version = $1)`, name).Scan(&applied); err != nil {
			return err
		}
		if applied {
			continue
		}
		sql, err := files.ReadFile(name)
		if err != nil {
			return err
		}
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			tx.Rollback(ctx) //nolint:errcheck // the Exec error is the one to report
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migration (version) VALUES ($1)`, name); err != nil {
			tx.Rollback(ctx) //nolint:errcheck
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
		slog.Info("migration applied", "store", "postgres", "version", name)
	}
	return nil
}

func sorted(dir string) ([]string, error) {
	names, err := fs.Glob(files, dir+"/*.sql")
	sort.Strings(names)
	return names, err
}

// ClickHouse applies the telemetry-plane migrations over the HTTP
// interface. Every statement is idempotent (IF NOT EXISTS), and a
// schema_migration table records each applied file.
type ClickHouse struct {
	URL, User, Password string
	Client              *http.Client
}

func (c ClickHouse) Apply(ctx context.Context) error {
	if c.Client == nil {
		c.Client = &http.Client{Timeout: 60 * time.Second}
	}
	if err := c.exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migration (version String, applied_at DateTime DEFAULT now())
		ENGINE = MergeTree ORDER BY version`); err != nil {
		return err
	}
	names, err := sorted("clickhouse")
	if err != nil {
		return err
	}
	for _, name := range names {
		applied, err := c.query(ctx, fmt.Sprintf(`SELECT count() FROM schema_migration WHERE version = '%s'`, name))
		if err != nil {
			return err
		}
		if strings.TrimSpace(applied) != "0" {
			continue
		}
		raw, err := files.ReadFile(name)
		if err != nil {
			return err
		}
		for _, stmt := range Statements(string(raw)) {
			if err := c.exec(ctx, stmt); err != nil {
				return fmt.Errorf("clickhouse migration %s: %w", name, err)
			}
		}
		if err := c.exec(ctx, fmt.Sprintf(`INSERT INTO schema_migration (version) VALUES ('%s')`, name)); err != nil {
			return err
		}
		slog.Info("migration applied", "store", "clickhouse", "version", name)
	}
	return nil
}

// Statements splits a migration file on lines that end a statement with ;
// (ClickHouse's HTTP interface takes one statement per request). Lines
// starting with -- are comments.
func Statements(sql string) []string {
	var out []string
	var cur strings.Builder
	for _, line := range strings.Split(sql, "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		cur.WriteString(line)
		cur.WriteString("\n")
		if strings.HasSuffix(trimmed, ";") {
			stmt := strings.TrimSuffix(strings.TrimSpace(cur.String()), ";")
			if stmt != "" {
				out = append(out, stmt)
			}
			cur.Reset()
		}
	}
	if rest := strings.TrimSpace(cur.String()); rest != "" {
		out = append(out, rest)
	}
	return out
}

func (c ClickHouse) exec(ctx context.Context, stmt string) error {
	_, err := c.query(ctx, stmt)
	return err
}

func (c ClickHouse) query(ctx context.Context, stmt string) (string, error) {
	u, err := url.Parse(c.URL)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewBufferString(stmt))
	if err != nil {
		return "", err
	}
	req.SetBasicAuth(c.User, c.Password)
	res, err := c.Client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if res.StatusCode != http.StatusOK {
		return "", fmt.Errorf("clickhouse %d: %s", res.StatusCode, strings.TrimSpace(string(body)))
	}
	return string(body), nil
}
