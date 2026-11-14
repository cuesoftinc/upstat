package service_test

import (
	"context"
	"errors"
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
		v, ok, err := repository.LeaseSnapshot(ctx, tx, snapshot.KindMonitors, time.Now().UnixMilli(), time.Hour)
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
		return repository.ReleaseSnapshots(ctx, tx, []string{snapshot.KindMonitors})
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
			v, ok, err := repository.LeaseSnapshot(ctx, tx, snapshot.KindOrgs, 1, 0)
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
