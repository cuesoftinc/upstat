// Package outbox publishes rows written by business transactions (§6.8).
// Every instance publishes; a short lease keeps them off each other's rows,
// and a row is marked published only after Kafka acknowledged it. A row that
// can never be sent is parked as failed, never marked published. A
// config.changed row is special: the publisher first rewrites that kind's
// snapshot from Postgres, under a per-kind lease so a slower publisher cannot
// overwrite a newer snapshot, so the message always points at the latest
// state. No connection is held while it writes to storage or Kafka. After a
// batch it wakes the services that consume what it sent.
package outbox

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sort"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	kgo "github.com/segmentio/kafka-go"

	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

const (
	batchSize = 100
	// publishLease outlives sendBudget, so a batch (and the snapshot kinds it
	// rewrites) still being sent is never leased to another pass.
	publishLease   = 2 * time.Minute
	sendBudget     = publishLease - 20*time.Second
	releaseTimeout = 5 * time.Second
)

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
	// Wake is called with each event a batch published, and returns once the
	// services that consume it have answered.
	Wake    func(ctx context.Context, event string)
	healthy bool
	// mu runs one batch at a time in this process, holding no connection while
	// a second caller waits, so a request that flushes still finds its rows
	// published when it answers.
	mu sync.Mutex
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
	p.mu.Lock()
	defer p.mu.Unlock()
	// Lease, send and mark each hold the connection for one short transaction;
	// the snapshot writes and Kafka calls in between hold none.
	var rows []repository.OutboxRow
	var snaps map[string]*claimed
	if err := p.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		if rows, err = repository.LeaseOutbox(ctx, tx, batchSize, publishLease); err != nil || len(rows) == 0 {
			return err
		}
		var kinds []string
		for _, row := range rows {
			if row.Event == bus.EventConfigChanged {
				kinds = append(kinds, row.Key)
			}
		}
		if snaps, err = claimSnapshots(ctx, tx, kinds, p.Now(), nil); err != nil {
			return err
		}
		// A kind another pass is rewriting keeps its rows for the next pass.
		kept, busy := rows[:0], []int64{}
		for _, row := range rows {
			if row.Event == bus.EventConfigChanged && snaps[row.Key] == nil {
				busy = append(busy, row.ID)
				continue
			}
			kept = append(kept, row)
		}
		rows = kept
		if len(busy) == 0 {
			return nil
		}
		return repository.ReleaseOutbox(ctx, tx, busy)
	}); err != nil || len(rows) == 0 {
		return 0, err
	}
	sent, ids, parked, err := p.send(ctx, rows, snaps)
	if err != nil {
		p.release(ctx, rows, snaps)
		return 0, err
	}
	if err := p.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		if err := repository.MarkPublished(ctx, tx, ids); err != nil {
			return err
		}
		for _, f := range parked {
			if err := repository.MarkFailedOutbox(ctx, tx, f.id, f.cause); err != nil {
				return err
			}
		}
		return repository.ReleaseSnapshots(ctx, tx, kindsOf(snaps))
	}); err != nil {
		return 0, err
	}
	for event, count := range sent {
		slog.Info("published to Kafka", "step", "outbox", "event", event, "topic", bus.TopicFor[event], "messages", count)
		if p.Wake != nil {
			p.Wake(ctx, event)
		}
	}
	return len(rows), nil
}

// claimed is a snapshot kind this pass owns: the version to write and the
// items read in the claiming transaction.
type claimed struct {
	version int64
	items   any
}

// parkedRow is a row that can never be sent, with the cause.
type parkedRow struct {
	id    int64
	cause string
}

// claimSnapshots leases each kind and reads its items in tx. A kind another
// pass holds is left out of the result. stored holds the version already in
// storage per kind, which the new version must exceed.
func claimSnapshots(ctx context.Context, tx pgx.Tx, kinds []string, now time.Time, stored map[string]int64) (map[string]*claimed, error) {
	out := map[string]*claimed{}
	sorted := append([]string(nil), kinds...)
	sort.Strings(sorted)
	for _, kind := range sorted {
		if out[kind] != nil {
			continue
		}
		floor := now.UnixMilli()
		if v, ok := stored[kind]; ok && v >= floor {
			floor = v + 1
		}
		version, ok, err := repository.LeaseSnapshot(ctx, tx, kind, floor, publishLease)
		if err != nil {
			return nil, err
		}
		if !ok {
			continue
		}
		items, err := repository.SnapshotItems(ctx, tx, kind)
		if err != nil {
			return nil, err
		}
		out[kind] = &claimed{version: version, items: items}
	}
	return out, nil
}

func kindsOf(snaps map[string]*claimed) []string {
	kinds := make([]string, 0, len(snaps))
	for kind := range snaps {
		kinds = append(kinds, kind)
	}
	sort.Strings(kinds)
	return kinds
}

// send writes the claimed snapshots, builds each row's message and writes
// them to Kafka, all within the lease. It returns the events sent, the ids to
// mark published and the rows to park. A crash before the mark re-sends after
// the lease; the consumers are idempotent by request_id (§9.2).
func (p *Publisher) send(ctx context.Context, rows []repository.OutboxRow, snaps map[string]*claimed) (map[string]int, []int64, []parkedRow, error) {
	ctx, cancel := context.WithTimeout(ctx, sendBudget)
	defer cancel()
	// Each kind's snapshot is written before the message that points at it.
	for _, kind := range kindsOf(snaps) {
		if err := snapshot.Put(ctx, p.Store, kind, snaps[kind].version, snaps[kind].items); err != nil {
			return nil, nil, nil, err
		}
	}
	msgs := make([]kgo.Message, 0, len(rows))
	ids := make([]int64, 0, len(rows))
	var parked []parkedRow
	sent := map[string]int{}
	rewritten := map[string]bool{}
	for _, row := range rows {
		payload := row.Payload
		if row.Event == bus.EventConfigChanged {
			if rewritten[row.Key] {
				ids = append(ids, row.ID) // one rewrite per kind per batch
				continue
			}
			var err error
			if payload, err = p.changed(row.Key, snaps[row.Key].version); err != nil {
				return nil, nil, nil, err
			}
			rewritten[row.Key] = true
		}
		msg, err := p.Producer.Message(ctx, row.Event, row.Key, row.RequestID, payload)
		if errors.Is(err, bus.ErrContract) {
			// A row that fails its schema can never be sent: park it as
			// failed so it doesn't block the queue, and keep the cause.
			slog.Error("outbox row violates the contract; parked as failed", "id", row.ID, "event", row.Event, "error", err)
			parked = append(parked, parkedRow{id: row.ID, cause: err.Error()})
			continue
		} else if err != nil {
			return nil, nil, nil, err // storage for the claim-check is down: retry the batch
		}
		msgs = append(msgs, msg)
		ids = append(ids, row.ID)
		sent[row.Event]++
	}
	if len(msgs) > 0 {
		if err := p.Producer.Write(ctx, msgs...); err != nil {
			return nil, nil, nil, err
		}
	}
	return sent, ids, parked, nil
}

// release frees the leases of a batch that was not sent so the next pass
// retries it at once and in order; a failed release leaves them to lapse.
func (p *Publisher) release(ctx context.Context, rows []repository.OutboxRow, snaps map[string]*claimed) {
	ids := make([]int64, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), releaseTimeout)
	defer cancel()
	if err := p.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		if err := repository.ReleaseOutbox(ctx, tx, ids); err != nil {
			return err
		}
		return repository.ReleaseSnapshots(ctx, tx, kindsOf(snaps))
	}); err != nil {
		slog.Warn("outbox lease not released; it lapses on its own", "error", err)
	}
}

// changed is the config.changed payload for a kind written at version.
func (p *Publisher) changed(kind string, version int64) (json.RawMessage, error) {
	return json.Marshal(map[string]any{
		"kind": kind, "version": version,
		"snapshot": bus.ObjectRef{Bucket: p.Store.Bucket(), Key: store.ConfigKey(p.Store, kind), ContentType: "application/json"},
	})
}

// WriteAll rewrites every snapshot (on start), so a fresh deployment's
// readers find one; it publishes nothing. A kind another pass is rewriting
// is skipped: that pass writes the latest state.
func WriteAll(ctx context.Context, db *repository.DB, s store.Store, now time.Time) error {
	stored := map[string]int64{}
	for _, kind := range snapshot.AllKinds {
		v, err := snapshot.StoredVersion(ctx, s, kind)
		if err != nil {
			return err
		}
		stored[kind] = v
	}
	var snaps map[string]*claimed
	if err := db.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		snaps, err = claimSnapshots(ctx, tx, snapshot.AllKinds, now, stored)
		return err
	}); err != nil {
		return err
	}
	wctx, cancel := context.WithTimeout(ctx, sendBudget)
	defer cancel()
	var werr error
	for _, kind := range kindsOf(snaps) {
		if werr = snapshot.Put(wctx, s, kind, snaps[kind].version, snaps[kind].items); werr != nil {
			break
		}
	}
	rctx, rcancel := context.WithTimeout(context.WithoutCancel(ctx), releaseTimeout)
	defer rcancel()
	rerr := db.AsSystem(rctx, func(tx pgx.Tx) error { return repository.ReleaseSnapshots(rctx, tx, kindsOf(snaps)) })
	return errors.Join(werr, rerr)
}
