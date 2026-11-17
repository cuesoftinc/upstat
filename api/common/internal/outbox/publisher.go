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

	"github.com/google/uuid"
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
	publishLease   = time.Minute
	sendBudget     = publishLease - 20*time.Second
	releaseTimeout = 5 * time.Second
	// lockWait bounds how long a caller waits for the batch another caller is
	// sending.
	lockWait     = sendBudget + releaseTimeout
	markAttempts = 3
)

// gate lets one caller in at a time and gives up when its context ends, which
// a sync.Mutex cannot; the zero value is ready.
type gate struct {
	once sync.Once
	ch   chan struct{}
}

func (g *gate) acquire(ctx context.Context) error {
	g.once.Do(func() { g.ch = make(chan struct{}, 1) })
	select {
	case g.ch <- struct{}{}:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (g *gate) release() { <-g.ch }

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
	// published when it answers; a waiter stops when its context or lockWait
	// ends, and the lock is let go before the services are woken.
	mu gate
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

// PublishBatch sends up to one batch and reports how many rows it took. The
// services that consume what it sent are woken after the batch lock is let go,
// so a slow wake never holds up the next flush.
func (p *Publisher) PublishBatch(ctx context.Context) (int, error) {
	n, sent, err := p.publish(ctx)
	if err != nil {
		return 0, err
	}
	for event, count := range sent {
		slog.Info("published to Kafka", "step", "outbox", "event", event, "topic", bus.TopicFor[event], "messages", count)
		if p.Wake != nil {
			p.Wake(ctx, event)
		}
	}
	return n, nil
}

// publish leases, sends and marks one batch under the batch lock. Every
// database step is one short transaction; the storage and Kafka calls in
// between hold no connection. The owner token keeps a pass whose lease lapsed
// from freeing or marking rows another pass has leased since.
func (p *Publisher) publish(ctx context.Context) (int, map[string]int, error) {
	waitCtx, cancelWait := context.WithTimeout(ctx, lockWait)
	err := p.mu.acquire(waitCtx)
	cancelWait()
	if err != nil {
		return 0, nil, err
	}
	defer p.mu.release()
	owner := uuid.NewString()
	var rows []repository.OutboxRow
	if err := p.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		rows, err = repository.LeaseOutbox(ctx, tx, batchSize, publishLease, owner)
		return err
	}); err != nil || len(rows) == 0 {
		return 0, nil, err
	}
	leased := rows
	// Everything up to the mark runs inside the lease.
	bctx, cancel := context.WithTimeout(ctx, sendBudget)
	defer cancel()

	var kinds []string
	for _, row := range rows {
		if row.Event == bus.EventConfigChanged {
			kinds = append(kinds, row.Key)
		}
	}
	var snaps map[string]*claimed
	if len(kinds) > 0 {
		// The version already in storage is read before the claim: an older
		// revision may have written it, and the new version must exceed it.
		stored, err := storedVersions(bctx, p.Store, kinds)
		if err != nil {
			p.release(ctx, leased, nil, owner)
			return 0, nil, err
		}
		if err := p.DB.AsSystem(bctx, func(tx pgx.Tx) (err error) {
			if snaps, err = claimSnapshots(bctx, tx, kinds, p.Now(), stored, owner); err != nil {
				return err
			}
			// A kind another pass is rewriting keeps its rows for the next pass.
			kept, busy := rows[:0:0], []int64{}
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
			return repository.ReleaseOutbox(bctx, tx, busy, owner)
		}); err != nil {
			p.release(ctx, leased, nil, owner)
			return 0, nil, err
		}
		if len(rows) == 0 {
			return 0, nil, nil
		}
	}
	res, err := p.send(bctx, rows, snaps)
	if err != nil {
		p.release(ctx, rows, snaps, owner)
		return 0, nil, err
	}
	if err := p.finish(ctx, owner, res, snaps); err != nil {
		return 0, nil, err
	}
	return len(rows) - len(res.retry), res.sent, nil
}

// finish records the outcome in one short transaction, retrying at once: a
// finish that failed would leave sent rows leased until the lease lapses and
// then send them again. It does not stop when ctx does, or a sent batch would
// go out twice.
func (p *Publisher) finish(ctx context.Context, owner string, res sendResult, snaps map[string]*claimed) (err error) {
	for attempt := 0; attempt < markAttempts; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 250 * time.Millisecond)
		}
		mctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), releaseTimeout)
		err = p.DB.AsSystem(mctx, func(tx pgx.Tx) error {
			if err := repository.MarkPublished(mctx, tx, res.ids, owner); err != nil {
				return err
			}
			for _, f := range res.parked {
				if err := repository.MarkFailedOutbox(mctx, tx, f.id, f.cause, owner); err != nil {
					return err
				}
			}
			if err := repository.ReleaseOutbox(mctx, tx, res.retry, owner); err != nil {
				return err
			}
			return repository.ReleaseSnapshots(mctx, tx, kindsOf(snaps), owner)
		})
		cancel()
		if err == nil {
			return nil
		}
		slog.Warn("outbox mark failed; retrying", "attempt", attempt+1, "error", err)
	}
	return err
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

// sendResult is what a send decided: the events sent, the ids to mark
// published, the rows to park and the rows to leave for the next pass.
type sendResult struct {
	sent   map[string]int
	ids    []int64
	parked []parkedRow
	retry  []int64
}

// storedVersions reads the version in storage for each kind.
func storedVersions(ctx context.Context, s store.Store, kinds []string) (map[string]int64, error) {
	stored := map[string]int64{}
	for _, kind := range kinds {
		if _, ok := stored[kind]; ok {
			continue
		}
		v, err := snapshot.StoredVersion(ctx, s, kind)
		if err != nil {
			return nil, err
		}
		stored[kind] = v
	}
	return stored, nil
}

// claimSnapshots takes each kind's advisory lock (waiting out an older
// revision's rewrite), leases the kind and reads its items in tx. A kind
// another pass holds is left out of the result. stored holds the version
// already in storage per kind, which the new version must exceed.
func claimSnapshots(ctx context.Context, tx pgx.Tx, kinds []string, now time.Time, stored map[string]int64, owner string) (map[string]*claimed, error) {
	out := map[string]*claimed{}
	sorted := append([]string(nil), kinds...)
	sort.Strings(sorted)
	if err := repository.LockSnapshots(ctx, tx, sorted...); err != nil {
		return nil, err
	}
	for _, kind := range sorted {
		if out[kind] != nil {
			continue
		}
		floor := now.UnixMilli()
		if v, ok := stored[kind]; ok && v >= floor {
			floor = v + 1
		}
		version, ok, err := repository.LeaseSnapshot(ctx, tx, kind, floor, publishLease, owner)
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

// putIfNewer writes a claimed snapshot unless storage already holds its
// version or a later one, which an older revision's publisher can have written
// after the claim; ok is false then and the kind is left for the next pass,
// which assigns a version above it. Only the instant between this read and the
// write is unguarded against an older revision, and only while both run.
func putIfNewer(ctx context.Context, s store.Store, kind string, c *claimed) (ok bool, err error) {
	v, err := snapshot.StoredVersion(ctx, s, kind)
	if err != nil {
		return false, err
	}
	if v >= c.version {
		slog.Warn("snapshot in storage is not older than the claimed version; left for the next pass", "kind", kind, "stored", v, "claimed", c.version)
		return false, nil
	}
	return true, snapshot.Put(ctx, s, kind, c.version, c.items)
}

// send writes the claimed snapshots, builds each row's message and writes
// them to Kafka, all within the lease (ctx carries its budget). A crash before
// the mark re-sends after the lease; the consumers are idempotent by
// request_id (§9.2).
func (p *Publisher) send(ctx context.Context, rows []repository.OutboxRow, snaps map[string]*claimed) (sendResult, error) {
	res := sendResult{sent: map[string]int{}}
	// Each kind's snapshot is written before the message that points at it.
	skipped := map[string]bool{}
	for _, kind := range kindsOf(snaps) {
		ok, err := putIfNewer(ctx, p.Store, kind, snaps[kind])
		if err != nil {
			return sendResult{}, err
		}
		skipped[kind] = !ok
	}
	msgs := make([]kgo.Message, 0, len(rows))
	rewritten := map[string]bool{}
	for _, row := range rows {
		payload := row.Payload
		if row.Event == bus.EventConfigChanged {
			if skipped[row.Key] {
				res.retry = append(res.retry, row.ID)
				continue
			}
			if rewritten[row.Key] {
				res.ids = append(res.ids, row.ID) // one rewrite per kind per batch
				continue
			}
			var err error
			if payload, err = p.changed(row.Key, snaps[row.Key].version); err != nil {
				return sendResult{}, err
			}
			rewritten[row.Key] = true
		}
		msg, err := p.Producer.Message(ctx, row.Event, row.Key, row.RequestID, payload)
		if errors.Is(err, bus.ErrContract) {
			// A row that fails its schema can never be sent: park it as
			// failed so it doesn't block the queue, and keep the cause.
			slog.Error("outbox row violates the contract; parked as failed", "id", row.ID, "event", row.Event, "error", err)
			res.parked = append(res.parked, parkedRow{id: row.ID, cause: err.Error()})
			continue
		} else if err != nil {
			return sendResult{}, err // storage for the claim-check is down: retry the batch
		}
		msgs = append(msgs, msg)
		res.ids = append(res.ids, row.ID)
		res.sent[row.Event]++
	}
	if len(msgs) > 0 {
		if err := p.Producer.Write(ctx, msgs...); err != nil {
			return sendResult{}, err
		}
	}
	return res, nil
}

// release frees the leases of a batch that was not sent so the next pass
// retries it at once and in order; a failed release leaves them to lapse.
func (p *Publisher) release(ctx context.Context, rows []repository.OutboxRow, snaps map[string]*claimed, owner string) {
	ids := make([]int64, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), releaseTimeout)
	defer cancel()
	if err := p.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		if err := repository.ReleaseOutbox(ctx, tx, ids, owner); err != nil {
			return err
		}
		return repository.ReleaseSnapshots(ctx, tx, kindsOf(snaps), owner)
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
	stored, err := storedVersions(ctx, s, snapshot.AllKinds)
	if err != nil {
		return err
	}
	owner := uuid.NewString()
	var snaps map[string]*claimed
	if err := db.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		snaps, err = claimSnapshots(ctx, tx, snapshot.AllKinds, now, stored, owner)
		return err
	}); err != nil {
		return err
	}
	wctx, cancel := context.WithTimeout(ctx, sendBudget)
	defer cancel()
	var werr error
	for _, kind := range kindsOf(snaps) {
		if _, werr = putIfNewer(wctx, s, kind, snaps[kind]); werr != nil {
			break
		}
	}
	rctx, rcancel := context.WithTimeout(context.WithoutCancel(ctx), releaseTimeout)
	defer rcancel()
	rerr := db.AsSystem(rctx, func(tx pgx.Tx) error { return repository.ReleaseSnapshots(rctx, tx, kindsOf(snaps), owner) })
	return errors.Join(werr, rerr)
}
