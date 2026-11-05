package repository

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
)

// ConsumerFailure is a message a consumer gave up on, kept whole.
type ConsumerFailure struct {
	ID               int64
	Event, RequestID string
	Message, Cause   string
	Attempts         int
	Permanent        bool
}

// InsertConsumerFailure records a message the consumer gave up on; a
// permanent one is abandoned at once, a retryable one is tried again later.
func InsertConsumerFailure(ctx context.Context, tx pgx.Tx, f ConsumerFailure, retryAfter time.Duration) error {
	_, err := tx.Exec(ctx, `INSERT INTO consumer_failures (event, request_id, message, cause, permanent, next_attempt_at, abandoned_at)
		VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6), CASE WHEN $5 THEN now() END)`,
		f.Event, f.RequestID, f.Message, f.Cause, f.Permanent, retryAfter.Seconds())
	return err
}

// ClaimConsumerFailures leases up to limit failures that are due for another
// try; no other instance takes them until the lease lapses.
func ClaimConsumerFailures(ctx context.Context, tx pgx.Tx, limit int, lease time.Duration) ([]ConsumerFailure, error) {
	rows, err := tx.Query(ctx, `WITH due AS (
			SELECT id FROM consumer_failures WHERE resolved_at IS NULL AND abandoned_at IS NULL AND next_attempt_at <= now()
			ORDER BY next_attempt_at LIMIT $1 FOR UPDATE SKIP LOCKED)
		UPDATE consumer_failures f SET next_attempt_at = now() + make_interval(secs => $2)
		FROM due WHERE f.id = due.id RETURNING f.id, f.event, f.request_id, f.message, f.cause, f.attempts, f.permanent`, limit, lease.Seconds())
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Row) (*ConsumerFailure, error) {
		var f ConsumerFailure
		return &f, r.Scan(&f.ID, &f.Event, &f.RequestID, &f.Message, &f.Cause, &f.Attempts, &f.Permanent)
	})
}

// ResolveConsumerFailure marks a failure handled.
func ResolveConsumerFailure(ctx context.Context, tx pgx.Tx, id int64) error {
	_, err := tx.Exec(ctx, `UPDATE consumer_failures SET resolved_at = now() WHERE id = $1`, id)
	return err
}

// RetryConsumerFailure counts another failed try: the next one waits
// backoff, and the failure is abandoned once it has had maxAttempts.
func RetryConsumerFailure(ctx context.Context, tx pgx.Tx, id int64, cause string, maxAttempts int, backoff time.Duration) error {
	_, err := tx.Exec(ctx, `UPDATE consumer_failures SET attempts = attempts + 1, cause = $2,
			next_attempt_at = now() + make_interval(secs => $4),
			abandoned_at = CASE WHEN attempts + 1 >= $3 THEN now() END
		WHERE id = $1`, id, cause, maxAttempts, backoff.Seconds())
	return err
}

// PruneConsumerFailures deletes resolved and abandoned failures older than olderThan.
func PruneConsumerFailures(ctx context.Context, tx pgx.Tx, olderThan time.Duration) (int64, error) {
	tag, err := tx.Exec(ctx, `DELETE FROM consumer_failures
		WHERE coalesce(resolved_at, abandoned_at) < now() - make_interval(secs => $1)`, olderThan.Seconds())
	return tag.RowsAffected(), err
}

// OpenConsumerFailures counts failures still waiting for a retry.
func OpenConsumerFailures(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	return n, tx.QueryRow(ctx, `SELECT count(*) FROM consumer_failures WHERE resolved_at IS NULL AND abandoned_at IS NULL`).Scan(&n)
}
