// Package repository is the only code that talks to Postgres (D3: api/common
// is its sole client). Every statement runs inside a transaction that is
// either scoped to one org, so row-level security keeps tenants apart (S-9),
// or explicitly marked as a system operation (sign-in, the scheduler,
// consumers, snapshots).
package repository

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNotFound is returned for missing rows, including rows of another org
// (cross-tenant access is not_found, never forbidden: engineering.md §2).
var ErrNotFound = errors.New("not found")

// ErrConflict is returned for unique-constraint violations.
var ErrConflict = errors.New("conflict")

type DB struct {
	Pool *pgxpool.Pool
}

func Open(ctx context.Context, url string) (*DB, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	return &DB{Pool: pool}, nil
}

func (db *DB) Close() { db.Pool.Close() }

func (db *DB) Ping(ctx context.Context) error { return db.Pool.Ping(ctx) }

// AsOrg runs fn in a transaction where row-level security sees only orgID.
func (db *DB) AsOrg(ctx context.Context, orgID string, fn func(pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, db.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('upstat.org_id', $1, true)`, orgID); err != nil {
			return err
		}
		return fn(tx)
	})
}

// AsSystem runs fn with row-level security bypassed.
func (db *DB) AsSystem(ctx context.Context, fn func(pgx.Tx) error) error {
	return pgx.BeginFunc(ctx, db.Pool, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, `SELECT set_config('upstat.bypass', 'on', true)`); err != nil {
			return err
		}
		return fn(tx)
	})
}

// translate maps driver errors onto the package's sentinel errors.
func translate(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return ErrConflict
	}
	return err
}

// collect scans every row with scan.
func collect[T any](rows pgx.Rows, scan func(pgx.Row) (*T, error)) ([]T, error) {
	defer rows.Close()
	out := []T{}
	for rows.Next() {
		v, err := scan(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *v)
	}
	return out, rows.Err()
}

// one returns the single row scan produced, or ErrNotFound.
func one[T any](row pgx.Row, scan func(pgx.Row) (*T, error)) (*T, error) {
	v, err := scan(row)
	if err != nil {
		return nil, translate(err)
	}
	return v, nil
}

func mustJSON(v any) []byte {
	raw, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return raw
}

// affected turns "0 rows" into ErrNotFound.
func affected(tag pgconn.CommandTag, err error) error {
	if err != nil {
		return translate(err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
