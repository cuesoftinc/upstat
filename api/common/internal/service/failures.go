package service

import (
	"context"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
)

// A message a consumer gave up on is stored whole in consumer_failures
// (messaging rule 10: record, commit, move on) and handled again from there:
// a pass of run-checks retries each due failure with a growing wait, and one
// that keeps failing is abandoned after maxFailureAttempts tries in all.
const (
	maxFailureAttempts = 5
	failureBackoff     = time.Minute
	failureBatch       = 50
	failureLease       = 5 * time.Minute
)

// RecordFailure is the consumers' recorder (bus.Consumer.OnFailure).
func (s *Services) RecordFailure(ctx context.Context, f bus.Failed) error {
	cause := ""
	if f.Cause != nil {
		cause = f.Cause.Error()
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		return repository.InsertConsumerFailure(ctx, tx, repository.ConsumerFailure{Event: f.Event, RequestID: f.RequestID,
			Message: string(f.Raw), Cause: cause, Permanent: f.Permanent}, failureBackoff)
	})
}

// RetryFailures handles the due failures again through replay (the
// consumer's own handlers) and returns how many it resolved.
func (s *Services) RetryFailures(ctx context.Context, replay func(ctx context.Context, raw []byte) error) (int, error) {
	var due []repository.ConsumerFailure
	if err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		due, err = repository.ClaimConsumerFailures(ctx, tx, failureBatch, failureLease)
		return err
	}); err != nil {
		return 0, err
	}
	resolved := 0
	for _, f := range due {
		rerr := replay(ctx, []byte(f.Message))
		if ctx.Err() != nil {
			return resolved, ctx.Err() // the lease lapses and another pass retries
		}
		err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
			if rerr == nil {
				return repository.ResolveConsumerFailure(ctx, tx, f.ID)
			}
			return repository.RetryConsumerFailure(ctx, tx, f.ID, rerr.Error(), maxFailureAttempts, failureBackoff<<f.Attempts)
		})
		if err != nil {
			return resolved, err
		}
		if rerr == nil {
			resolved++
			slog.InfoContext(ctx, "failed message handled on retry", "event", f.Event, "request_id", f.RequestID)
		} else {
			slog.WarnContext(ctx, "failed message still failing", "event", f.Event, "request_id", f.RequestID, "attempts", f.Attempts+1, "error", rerr)
		}
	}
	return resolved, nil
}
