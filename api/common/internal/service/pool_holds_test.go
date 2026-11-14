package service_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/outbox"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

func (e *env) publisher(t *testing.T, snd *sender) *outbox.Publisher {
	contract, err := bus.LoadContract()
	if err != nil {
		t.Fatal(err)
	}
	snd.p, _ = bus.NewProducer(bus.Config{Brokers: []string{"localhost:1"}}, contract, e.blobs)
	snd.pool, snd.t = e.db.Pool, t
	return &outbox.Publisher{DB: e.db, Producer: snd, Store: e.blobs, Interval: time.Second, Now: time.Now}
}

// A failed Kafka write frees the lease: the rows stay unsent, the next pass
// retries them at once, and the snapshot version moves forward.
func TestOutboxFailedSendKeepsRowsAndRetries(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")
	snd := &sender{fail: errors.New("kafka down")}
	pub := e.publisher(t, snd)

	before := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL`)
	if before == 0 {
		t.Fatal("no outbox rows to publish")
	}
	if n, err := pub.PublishBatch(ctx); err == nil || n != 0 {
		t.Fatalf("a failed send must report the error: n=%d err=%v", n, err)
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL`); got != before {
		t.Fatalf("a failed send changed the unsent rows: %d, want %d", got, before)
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE lease_until IS NOT NULL`); got != 0 {
		t.Fatalf("%d rows still leased after the failed send", got)
	}
	if got := e.count(t, `SELECT count(*) FROM config_snapshot WHERE lease_until IS NOT NULL`); got != 0 {
		t.Fatalf("%d snapshot kinds still leased after the failed send", got)
	}
	snd.fail = nil
	n, err := pub.PublishBatch(ctx)
	if err != nil || n != before || len(snd.sent) == 0 {
		t.Fatalf("retry: n=%d (want %d) err=%v sent=%d", n, before, err, len(snd.sent))
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL`); got != 0 {
		t.Fatalf("%d rows unsent after the retry", got)
	}
}

// A kind another pass is rewriting keeps its rows for the next pass; once the
// lease is free the rewrite goes out at a higher version.
func TestSnapshotKindHeldByAnotherPassIsDeferred(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	if _, err := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")}); err != nil {
		t.Fatal(err)
	}
	var held int64
	e.system(t, func(ctx context.Context, tx pgx.Tx) error {
		v, ok, err := repository.LeaseSnapshot(ctx, tx, snapshot.KindMonitors, time.Now().UnixMilli(), time.Hour, "other")
		if !ok {
			t.Fatal("first lease refused")
		}
		held = v
		return err
	})
	snd := &sender{}
	pub := e.publisher(t, snd)
	if _, err := pub.PublishBatch(ctx); err != nil {
		t.Fatal(err)
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE event = $1 AND message_key = $2 AND published_at IS NULL AND failed_at IS NULL`, bus.EventConfigChanged, snapshot.KindMonitors); got != 1 {
		t.Fatalf("%d monitors config rows unsent while the kind is leased; want 1", got)
	}
	e.system(t, func(ctx context.Context, tx pgx.Tx) error {
		return repository.ReleaseSnapshots(ctx, tx, []string{snapshot.KindMonitors}, "other")
	})
	if _, err := pub.PublishBatch(ctx); err != nil {
		t.Fatal(err)
	}
	mons, version, err := snapshot.Read[snapshot.Monitor](ctx, e.blobs, snapshot.KindMonitors)
	if err != nil || len(mons) != 1 || version <= held {
		t.Fatalf("rewrite after release: %d monitors, version %d (held %d), %v", len(mons), version, held, err)
	}
}

// Snapshot versions only rise: across leases, and over a version already in
// storage that a clock reading would undercut.
func TestSnapshotVersionsOnlyRise(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	var last int64
	for i := 0; i < 3; i++ {
		e.system(t, func(ctx context.Context, tx pgx.Tx) error {
			v, ok, err := repository.LeaseSnapshot(ctx, tx, snapshot.KindOrgs, 1, 0, "t")
			if err != nil || !ok || v <= last {
				t.Fatalf("lease %d: version %d after %d, ok=%v err=%v", i, v, last, ok, err)
			}
			last = v
			return nil
		})
	}
	// A snapshot already stored beyond the clock: WriteAll goes above it.
	future := time.Now().Add(time.Hour).UnixMilli()
	if err := snapshot.Put(ctx, e.blobs, snapshot.KindMembers, future, []snapshot.UserAccess{}); err != nil {
		t.Fatal(err)
	}
	if err := outbox.WriteAll(ctx, e.db, e.blobs, time.Now()); err != nil {
		t.Fatal(err)
	}
	if v, err := snapshot.StoredVersion(ctx, e.blobs, snapshot.KindMembers); err != nil || v <= future {
		t.Fatalf("WriteAll left version %d, want above %d (%v)", v, future, err)
	}
	for _, kind := range snapshot.AllKinds {
		if v, _ := snapshot.StoredVersion(ctx, e.blobs, kind); v == 0 {
			t.Fatalf("WriteAll wrote no snapshot for %s", kind)
		}
	}
}

func (e *env) system(t *testing.T, fn func(ctx context.Context, tx pgx.Tx) error) {
	t.Helper()
	ctx := context.Background()
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error { return fn(ctx, tx) }); err != nil {
		t.Fatal(err)
	}
}

// Wake waits for cold services, so it runs after the batch lock is let go: a
// flush that arrives meanwhile is not held up behind it.
func TestWakeDoesNotHoldTheBatchLock(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "First")
	snd := &sender{}
	pub := e.publisher(t, snd)
	entered, release := make(chan struct{}, 8), make(chan struct{})
	var blocked atomic.Bool
	pub.Wake = func(context.Context, string) {
		entered <- struct{}{}
		if blocked.CompareAndSwap(false, true) {
			<-release
		}
	}
	first := make(chan error, 1)
	go func() { _, err := pub.PublishBatch(ctx); first <- err }()
	select {
	case <-entered:
	case <-time.After(10 * time.Second):
		t.Fatal("the first batch never woke anyone")
	}
	e.dueMonitor(t, c, "Second")
	second := make(chan error, 1)
	go func() { _, err := pub.PublishBatch(ctx); second <- err }()
	select {
	case err := <-second:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(10 * time.Second):
		t.Fatal("a flush waited behind another batch's Wake")
	}
	close(release)
	if err := <-first; err != nil {
		t.Fatal(err)
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL`); got != 0 {
		t.Fatalf("%d rows unsent", got)
	}
}

// A caller waiting behind a stuck send stops when its context ends.
func TestPublishWaiterStopsWithItsContext(t *testing.T) {
	e := newEnv(t)
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")
	snd := &sender{stall: make(chan struct{}), entered: make(chan struct{}, 1)}
	pub := e.publisher(t, snd)
	done := make(chan error, 1)
	go func() { _, err := pub.PublishBatch(context.Background()); done <- err }()
	<-snd.entered

	ctx, cancel := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel()
	waited := make(chan error, 1)
	go func() { _, err := pub.PublishBatch(ctx); waited <- err }()
	select {
	case err := <-waited:
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("waiter error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("a waiting flush ignored its context while another send was stuck")
	}
	close(snd.stall)
	if err := <-done; err != nil {
		t.Fatalf("stalled batch: %v", err)
	}
}

// A pass whose lease lapsed cannot free, mark or park rows or snapshot kinds
// another pass has leased since.
func TestOwnerTokenGuardsReleaseMarkAndSnapshots(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")
	lease := func(owner string) (rows []repository.OutboxRow) {
		e.system(t, func(ctx context.Context, tx pgx.Tx) (err error) {
			rows, err = repository.LeaseOutbox(ctx, tx, 100, time.Hour, owner)
			return err
		})
		return rows
	}
	first := lease("old")
	if len(first) == 0 {
		t.Fatal("nothing leased")
	}
	e.exec(t, `UPDATE outbox SET lease_until = now() - interval '1 second'`)
	if got := lease("new"); len(got) != len(first) {
		t.Fatalf("new pass leased %d of %d lapsed rows", len(got), len(first))
	}
	ids := make([]int64, len(first))
	for i, r := range first {
		ids[i] = r.ID
	}
	e.system(t, func(ctx context.Context, tx pgx.Tx) error { return repository.ReleaseOutbox(ctx, tx, ids, "old") })
	if again := lease("third"); len(again) != 0 {
		t.Fatalf("a late release freed %d of another pass's rows", len(again))
	}
	e.system(t, func(ctx context.Context, tx pgx.Tx) error {
		if err := repository.MarkFailedOutbox(ctx, tx, ids[0], "late", "old"); err != nil {
			return err
		}
		return repository.MarkPublished(ctx, tx, ids, "old")
	})
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL AND failed_at IS NULL`); got != len(first) {
		t.Fatalf("a late mark or park touched another pass's rows: %d still in flight of %d", got, len(first))
	}
	e.system(t, func(ctx context.Context, tx pgx.Tx) error { return repository.MarkPublished(ctx, tx, ids, "new") })
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NULL`); got != 0 {
		t.Fatalf("the owner's mark left %d unsent", got)
	}

	// Snapshot kinds: the same guard.
	snapLease := func(owner string) bool {
		var ok bool
		e.system(t, func(ctx context.Context, tx pgx.Tx) (err error) {
			_, ok, err = repository.LeaseSnapshot(ctx, tx, snapshot.KindOrgs, 1, time.Hour, owner)
			return err
		})
		return ok
	}
	if !snapLease("old") {
		t.Fatal("first snapshot lease refused")
	}
	e.exec(t, `UPDATE config_snapshot SET lease_until = now() - interval '1 second'`)
	if !snapLease("new") {
		t.Fatal("lapsed snapshot lease not retaken")
	}
	e.system(t, func(ctx context.Context, tx pgx.Tx) error {
		return repository.ReleaseSnapshots(ctx, tx, []string{snapshot.KindOrgs}, "old")
	})
	if snapLease("third") {
		t.Fatal("a late ReleaseSnapshots freed another pass's kind")
	}
	_ = ctx
}

// A config.changed row whose kind another pass is rewriting is not leased, so
// held rows cannot fill the batch and starve the others.
func TestHeldKindsRowsDoNotFillTheBatch(t *testing.T) {
	e := newEnv(t)
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")
	e.exec(t, `UPDATE outbox SET published_at = now()`)
	e.exec(t, `INSERT INTO outbox (event, message_key, payload, request_id)
		SELECT $1, 'monitors', '{"kind":"monitors"}', gen_random_uuid()::text FROM generate_series(1, 5)`, bus.EventConfigChanged)
	e.exec(t, `INSERT INTO outbox (event, message_key, payload, request_id) VALUES ($1, 'rules', '{"kind":"rules"}', gen_random_uuid()::text)`, bus.EventConfigChanged)
	e.system(t, func(ctx context.Context, tx pgx.Tx) error {
		_, _, err := repository.LeaseSnapshot(ctx, tx, snapshot.KindMonitors, 1, time.Hour, "other")
		return err
	})
	var rows []repository.OutboxRow
	e.system(t, func(ctx context.Context, tx pgx.Tx) (err error) {
		rows, err = repository.LeaseOutbox(ctx, tx, 3, time.Hour, "me")
		return err
	})
	if len(rows) != 1 || rows[0].Key != "rules" {
		t.Fatalf("leased %+v; want only the rules row while monitors is held", rows)
	}
}

// A snapshot an older revision wrote after this pass claimed is never lowered:
// the write is skipped, the row is kept and the next pass goes above it.
func TestClaimedVersionBelowStorageSkipsTheWrite(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.exec(t, `UPDATE outbox SET published_at = now()`)
	if _, err := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")}); err != nil {
		t.Fatal(err)
	}
	if kinds := e.count(t, `SELECT count(DISTINCT message_key) FROM outbox WHERE published_at IS NULL AND event = $1`, bus.EventConfigChanged); kinds != 1 {
		t.Fatalf("%d config kinds queued; the test injects at the first re-read and needs one", kinds)
	}
	future := time.Now().Add(time.Hour).UnixMilli()
	probe := e.blobs.Before
	var gets int
	e.blobs.Before = func(op string) {
		probe(op)
		if op != "get" {
			return
		}
		gets++
		if gets == 2 { // the re-read just before the write: the older revision has just written
			if err := snapshot.Put(ctx, e.blobs, snapshot.KindMonitors, future, []snapshot.Monitor{}); err != nil {
				t.Error(err)
			}
		}
	}
	snd := &sender{}
	pub := e.publisher(t, snd)
	if _, err := pub.PublishBatch(ctx); err != nil {
		t.Fatal(err)
	}
	if v, err := snapshot.StoredVersion(ctx, e.blobs, snapshot.KindMonitors); err != nil || v != future {
		t.Fatalf("stored version %d after the pass, want %d kept (%v)", v, future, err)
	}
	if got := e.count(t, `SELECT count(*) FROM outbox WHERE event = $1 AND message_key = $2 AND published_at IS NULL AND failed_at IS NULL AND lease_until IS NULL`, bus.EventConfigChanged, snapshot.KindMonitors); got != 1 {
		t.Fatalf("%d monitors rows waiting for the next pass; want 1", got)
	}
	e.blobs.Before = probe
	if _, err := pub.PublishBatch(ctx); err != nil {
		t.Fatal(err)
	}
	mons, v, err := snapshot.Read[snapshot.Monitor](ctx, e.blobs, snapshot.KindMonitors)
	if err != nil || v <= future || len(mons) != 1 {
		t.Fatalf("next pass: version %d (want above %d), %d monitors, %v", v, future, len(mons), err)
	}
}

// The claim takes the advisory lock an older revision's publisher holds across
// its rewrite, so a mixed deploy cannot interleave two rewrites of one kind.
func TestClaimWaitsForAnOlderRevisionsRewrite(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")
	e.blobs.Before = nil // the test holds a connection of its own
	old, err := e.db.Pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer old.Rollback(ctx) //nolint:errcheck // already committed on the happy path
	if _, err := old.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('snapshot:' || $1))`, snapshot.KindMonitors); err != nil {
		t.Fatal(err)
	}
	snd := &sender{}
	pub := e.publisher(t, snd)
	e.blobs.Before = nil
	done := make(chan error, 1)
	go func() { _, err := pub.PublishBatch(ctx); done <- err }()
	select {
	case err := <-done:
		t.Fatalf("the pass rewrote a kind while an older revision held its lock (err %v)", err)
	case <-time.After(500 * time.Millisecond):
	}
	// The older revision stores a version and commits.
	future := time.Now().Add(time.Hour).UnixMilli()
	if err := snapshot.Put(ctx, e.blobs, snapshot.KindMonitors, future, []snapshot.Monitor{}); err != nil {
		t.Fatal(err)
	}
	if err := old.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-done; err != nil {
		t.Fatal(err)
	}
	if v, err := snapshot.StoredVersion(ctx, e.blobs, snapshot.KindMonitors); err != nil || v < future {
		t.Fatalf("the older revision's version was lowered to %d (want at least %d, %v)", v, future, err)
	}
}
