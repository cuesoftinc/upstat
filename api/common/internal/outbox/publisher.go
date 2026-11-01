// Package outbox publishes rows written by business transactions (§6.8).
// Every instance runs a publisher; SKIP LOCKED keeps them off each other's
// rows, and a row is marked published only after Kafka acknowledged it.
// A config.changed row is special: the publisher first rewrites that kind's
// snapshot from Postgres, so the message always points at the latest state.
// After a batch it wakes the services that consume what it sent.
package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5"
	kgo "github.com/segmentio/kafka-go"

	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

const batchSize = 100

// Sender is the slice of the producer the publisher needs.
type Sender interface {
	Message(ctx context.Context, event, key, requestID string, data json.RawMessage) (kgo.Message, error)
	Write(ctx context.Context, msgs ...kgo.Message) error
}

type Publisher struct {
	DB       *repository.DB
	Producer Sender
	Store    store.Store
	Interval time.Duration
	Now      func() time.Time
	// Wake is called with each event a batch published.
	Wake    func(event string)
	healthy bool
}

func (p *Publisher) Healthy() bool { return p.healthy }

// Run publishes until ctx ends. Kafka being down leaves rows queued (§9.2).
func (p *Publisher) Run(ctx context.Context) {
	ticker := time.NewTicker(p.Interval)
	defer ticker.Stop()
	for {
		for {
			n, err := p.PublishBatch(ctx)
			p.healthy = err == nil
			if err != nil && ctx.Err() == nil {
				slog.Warn("outbox publish failed; will retry", "error", err)
			}
			if err != nil || n < batchSize {
				break
			}
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// PublishBatch sends up to one batch and reports how many rows it took.
func (p *Publisher) PublishBatch(ctx context.Context) (int, error) {
	var n int
	var sent map[string]int
	err := p.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		rows, err := repository.ClaimOutbox(ctx, tx, batchSize)
		if err != nil || len(rows) == 0 {
			return err
		}
		msgs := make([]kgo.Message, 0, len(rows))
		ids := make([]int64, 0, len(rows))
		rewritten := map[string]bool{}
		sent = map[string]int{}
		for _, row := range rows {
			payload := row.Payload
			if row.Event == bus.EventConfigChanged {
				if rewritten[row.Key] {
					ids = append(ids, row.ID) // one rewrite per kind per batch
					continue
				}
				if payload, err = p.rewrite(ctx, tx, row.Key); err != nil {
					return err
				}
				rewritten[row.Key] = true
			}
			msg, err := p.Producer.Message(ctx, row.Event, row.Key, row.RequestID, payload)
			if errors.Is(err, bus.ErrContract) {
				// A row that fails its schema can never be sent; park it
				// as published so it doesn't block the queue, and say so.
				slog.Error("outbox row violates the contract; skipped", "id", row.ID, "event", row.Event, "error", err)
				ids = append(ids, row.ID)
				continue
			} else if err != nil {
				return err // storage for the claim-check is down: retry the batch
			}
			msgs = append(msgs, msg)
			ids = append(ids, row.ID)
			sent[row.Event]++
		}
		if len(msgs) > 0 {
			if err := p.Producer.Write(ctx, msgs...); err != nil {
				return err
			}
		}
		n = len(rows)
		return repository.MarkPublished(ctx, tx, ids)
	})
	if err == nil {
		for event, count := range sent {
			slog.Info("published to Kafka", "step", "outbox", "event", event, "topic", bus.TopicFor[event], "messages", count)
			if p.Wake != nil {
				p.Wake(event)
			}
		}
	}
	return n, err
}

// rewrite stores kind's snapshot and returns the config.changed payload.
func (p *Publisher) rewrite(ctx context.Context, tx pgx.Tx, kind string) (json.RawMessage, error) {
	items, err := repository.SnapshotItems(ctx, tx, kind)
	if err != nil {
		return nil, err
	}
	version, err := snapshot.Write(ctx, p.Store, kind, items, p.Now())
	if err != nil {
		return nil, err
	}
	return json.Marshal(map[string]any{
		"kind": kind, "version": version,
		"snapshot": bus.ObjectRef{Bucket: p.Store.Bucket(), Key: store.ConfigKey(p.Store, kind), ContentType: "application/json"},
	})
}

// WriteAll rewrites every snapshot (on start), so a fresh deployment's
// readers find one; it publishes nothing.
func WriteAll(ctx context.Context, db *repository.DB, s store.Store, now time.Time) error {
	return db.AsSystem(ctx, func(tx pgx.Tx) error {
		for _, kind := range snapshot.AllKinds {
			items, err := repository.SnapshotItems(ctx, tx, kind)
			if err != nil {
				return err
			}
			if _, err := snapshot.Write(ctx, s, kind, items, now); err != nil {
				return err
			}
		}
		return nil
	})
}
