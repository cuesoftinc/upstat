package service_test

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/outbox"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

func (e *env) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	ctx := context.Background()
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, sql, args...)
		return err
	}); err != nil {
		t.Fatal(err)
	}
}

func (e *env) count(t *testing.T, sql string, args ...any) int {
	t.Helper()
	ctx := context.Background()
	var n int
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error { return tx.QueryRow(ctx, sql, args...).Scan(&n) }); err != nil {
		t.Fatal(err)
	}
	return n
}

func (e *env) dueMonitor(t *testing.T, c *service.Caller, name string) *model.Monitor {
	t.Helper()
	m, err := e.s.CreateMonitor(context.Background(), c, service.MonitorInput{Name: ptr(name), Target: ptr("https://" + strings.ToLower(name) + ".example.com")})
	if err != nil {
		t.Fatal(err)
	}
	e.exec(t, `UPDATE monitors SET next_run_at = now() - interval '5 seconds' WHERE id = $1`, m.ID)
	return m
}

// A pass that dies after probing must not lose the tick: the next pass
// dispatches the same slot.
func TestMissedTickIsRetriedAfterAFailedPass(t *testing.T) {
	e := newEnv(t)
	c := e.withOrg(t, "ada@example.com", "Acme")
	m := e.dueMonitor(t, c, "Homepage")
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	e.prober.onCheck = cancel // the pass is cancelled while the probes are in flight

	if err := e.s.RunChecks(ctx); err == nil {
		t.Fatal("RunChecks on a cancelled pass = nil; want its error")
	}
	if n := e.count(t, `SELECT count(*) FROM outbox WHERE event = $1`, bus.EventSyntheticResult); n != 0 {
		t.Fatalf("%d results queued by a pass that failed before recording the tick", n)
	}
	e.prober.onCheck = nil
	e.prober.calls = nil
	if err := e.s.RunChecks(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(e.prober.calls) != 2 {
		t.Fatalf("the retry pass probed %v; want both regions of the missed slot", e.prober.calls)
	}
	if n := e.count(t, `SELECT count(*) FROM outbox WHERE event = $1`, bus.EventSyntheticResult); n != 2 {
		t.Fatalf("%d results queued after the retry; want 2", n)
	}
	e.prober.calls = nil
	if err := e.s.RunChecks(context.Background()); err != nil || len(e.prober.calls) != 0 {
		t.Fatalf("a third pass re-ran the recorded slot: %v %v", err, e.prober.calls)
	}
	_ = m
}

// A pass that is killed outright leaves its lease; the monitor is claimable
// again when the lease lapses, and not before.
func TestClaimIsALeaseAndNeverDispatchesTwice(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	e.dueMonitor(t, c, "Homepage")

	claim := func(tx pgx.Tx) []repository.DueMonitor {
		due, err := repository.ClaimDueMonitors(ctx, tx, 10, time.Minute)
		if err != nil {
			t.Fatal(err)
		}
		return due
	}
	var concurrent, first int
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		first = len(claim(tx))
		// A second pass claiming while the first holds the row skips it.
		return e.db.AsSystem(ctx, func(tx2 pgx.Tx) error { concurrent = len(claim(tx2)); return nil })
	}); err != nil {
		t.Fatal(err)
	}
	if first != 1 || concurrent != 0 {
		t.Fatalf("claims = %d then %d; want 1 then 0 (no double dispatch)", first, concurrent)
	}
	var again int
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error { again = len(claim(tx)); return nil })
	if again != 0 {
		t.Fatal("a leased monitor was claimed by another pass before the lease lapsed")
	}
	e.exec(t, `UPDATE monitors SET leased_until = now() - interval '1 second'`)
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error { again = len(claim(tx)); return nil })
	if again != 1 {
		t.Fatal("a monitor whose lease lapsed was not claimed again")
	}
}

// A row that breaks its schema is parked as failed, never marked published.
func TestOutboxParksAContractViolation(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	if err := e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		return repository.Enqueue(ctx, tx, bus.EventSyntheticResult, "k", "req-1", map[string]any{"nonsense": true})
	}); err != nil {
		t.Fatal(err)
	}
	contract, err := bus.LoadContract()
	if err != nil {
		t.Fatal(err)
	}
	producer, _ := bus.NewProducer(bus.Config{Brokers: []string{"localhost:1"}}, contract, e.blobs)
	snd := &sender{p: producer}
	pub := &outbox.Publisher{DB: e.db, Producer: snd, Store: e.blobs, Interval: time.Second, Now: time.Now}
	if _, err := pub.PublishBatch(ctx); err != nil {
		t.Fatal(err)
	}
	if len(snd.sent) != 0 {
		t.Fatalf("%d invalid messages sent", len(snd.sent))
	}
	if n := e.count(t, `SELECT count(*) FROM outbox WHERE published_at IS NOT NULL`); n != 0 {
		t.Fatalf("%d contract-violating rows marked published; want them parked as failed", n)
	}
	if n := e.count(t, `SELECT count(*) FROM outbox WHERE failed_at IS NOT NULL AND failure <> ''`); n != 1 {
		t.Fatalf("%d rows parked with a cause; want 1", n)
	}
	if n, _ := pub.PublishBatch(ctx); n != 0 {
		t.Fatal("the parked row blocks the queue: it was claimed again")
	}
}

// Concurrent publishers each rewrite the snapshot under a lock and the
// stored version only rises.
func TestConcurrentPublishersNeverLowerTheSnapshot(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	for i := 0; i < 4; i++ {
		e.dueMonitor(t, c, "M"+string(rune('A'+i)))
	}
	contract, _ := bus.LoadContract()
	producer, _ := bus.NewProducer(bus.Config{Brokers: []string{"localhost:1"}}, contract, e.blobs)
	errs := make(chan error, 4)
	for i := 0; i < 4; i++ {
		go func() {
			pub := &outbox.Publisher{DB: e.db, Producer: &sender{p: producer}, Store: e.blobs, Interval: time.Second, Now: time.Now}
			for {
				n, err := pub.PublishBatch(ctx)
				if err != nil || n == 0 {
					errs <- err
					return
				}
			}
		}()
	}
	for i := 0; i < 4; i++ {
		if err := <-errs; err != nil {
			t.Fatal(err)
		}
	}
	mons, v1, err := snapshot.Read[snapshot.Monitor](ctx, e.blobs, snapshot.KindMonitors)
	if err != nil || len(mons) != 4 {
		t.Fatalf("snapshot after concurrent publishers: %d monitors, %v; want all 4", len(mons), err)
	}
	if err := outbox.WriteAll(ctx, e.db, e.blobs, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, v2, _ := snapshot.Read[snapshot.Monitor](ctx, e.blobs, snapshot.KindMonitors); v2 < v1 {
		t.Fatalf("snapshot version fell from %v to %v", v1, v2)
	}
}

func TestPublicStatusPageShowsOnlyItsOwnPublicEntries(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	shown, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("API"), Target: ptr("https://api.example.com")})
	hidden, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Billing"), Target: ptr("https://billing.example.com")})
	if _, err := e.s.SaveStatusPage(ctx, c, model.StatusPageConfig{Name: "Acme status", Slug: "acme",
		Components: []model.StatusComponentConfig{{ID: "draft_1", Name: "API", MonitorID: &shown.ID}}}); err != nil {
		t.Fatal(err)
	}
	_ = e.s.OnTransition(ctx, transition(shown, c.OrgID, 1, "pending", "down"))
	_ = e.s.OnTransition(ctx, transition(hidden, c.OrgID, 1, "pending", "down"))
	incidents, err := e.s.ListIncidents(ctx, c)
	if err != nil || len(incidents) != 2 {
		t.Fatalf("incidents %v %v", incidents, err)
	}
	for _, inc := range incidents {
		if _, err := e.s.AddTimeline(ctx, c, inc.ID, service.TimelineInput{Body: "root cause: expired credential in " + inc.Title, Author: "ada"}); err != nil {
			t.Fatal(err)
		}
		if strings.HasPrefix(inc.Title, "API") {
			if _, err := e.s.AddTimeline(ctx, c, inc.ID, service.TimelineInput{Body: "We are looking into it", Author: "ada", Public: true}); err != nil {
				t.Fatal(err)
			}
		}
	}
	page, err := e.s.PublicStatusPage(ctx, "acme")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Incidents) != 1 || !strings.HasPrefix(page.Incidents[0].Title, "API") {
		t.Fatalf("page lists %+v; want only the incident of a monitor on the page", page.Incidents)
	}
	raw, _ := json.Marshal(page)
	if strings.Contains(string(raw), "root cause") || strings.Contains(string(raw), "Billing") {
		t.Fatalf("internal text reached the public page: %s", raw)
	}
	if !strings.Contains(string(raw), "We are looking into it") {
		t.Fatalf("the public update is missing: %s", raw)
	}
}

func TestBrowserCheckURLIsValidatedLikeAMonitorTarget(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	for _, url := range []string{"http://169.254.169.254/latest/meta-data", "http://localhost:5432/", "https://user:pass@example.com/", "http://10.0.0.5/admin"} {
		_, err := e.s.CreateSynthetic(ctx, c, service.SyntheticInput{Name: ptr("Flow"), Kind: ptr("browser"), IntervalSeconds: ptr(300),
			Browser: &model.BrowserConfig{URL: url, Viewport: "1440x900"}})
		if err == nil {
			t.Fatalf("browser check accepted %q", url)
		}
	}
}

// The last-owner rule holds when two owners remove each other at once.
func TestLastOwnerCannotBeRemovedConcurrently(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	a := e.withOrg(t, "ada@example.com", "Acme")
	b := e.signIn(t, "bob@example.com")
	bobMember, err := e.s.InviteMember(ctx, a, "bob@example.com", "admin")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.UpdateMember(ctx, a, bobMember.ID, ptr("owner"), nil); err != nil {
		t.Fatal(err)
	}
	b = e.refresh(t, b)
	members, err := e.s.ListMembers(ctx, a)
	if err != nil || len(members) != 2 {
		t.Fatalf("members %v %v", members, err)
	}
	var adaMember string
	for _, m := range members {
		if m.Email == "ada@example.com" {
			adaMember = m.ID
		}
	}
	done := make(chan error, 2)
	go func() { done <- e.s.RemoveMember(ctx, a, bobMember.ID) }()
	go func() { done <- e.s.RemoveMember(ctx, b, adaMember) }()
	ok, refused := 0, 0
	for i := 0; i < 2; i++ {
		switch err := <-done; code(err) {
		case "":
			ok++
		case "last_owner":
			refused++
		default:
			t.Fatalf("unexpected: %v", err)
		}
	}
	if ok != 1 || refused != 1 {
		t.Fatalf("removed %d, refused %d; want exactly one removal so an owner is left", ok, refused)
	}
	if n := e.count(t, `SELECT count(*) FROM members WHERE role = 'owner' AND status = 'active'`); n != 1 {
		t.Fatalf("%d owners left; want 1", n)
	}
}

func TestFailedConsumerMessagesAreRecordedAndRetried(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	if err := e.s.RecordFailure(ctx, bus.Failed{Event: bus.EventTransition, RequestID: "r1", Raw: []byte(`{"x":1}`), Cause: errString("db away")}); err != nil {
		t.Fatal(err)
	}
	if err := e.s.RecordFailure(ctx, bus.Failed{Event: bus.EventTransition, RequestID: "r2", Raw: []byte(`junk`), Cause: errString("bad json"), Permanent: true}); err != nil {
		t.Fatal(err)
	}
	if n := e.count(t, `SELECT count(*) FROM consumer_failures`); n != 2 {
		t.Fatalf("%d failures recorded; want 2", n)
	}
	var replayed []string
	replay := func(_ context.Context, raw []byte) error { replayed = append(replayed, string(raw)); return nil }
	if n, err := e.s.RetryFailures(ctx, replay); err != nil || n != 0 {
		t.Fatalf("retry before the wait = %d, %v; want none due", n, err)
	}
	e.exec(t, `UPDATE consumer_failures SET next_attempt_at = now() - interval '1 second'`)
	n, err := e.s.RetryFailures(ctx, replay)
	if err != nil || n != 1 || len(replayed) != 1 || replayed[0] != `{"x":1}` {
		t.Fatalf("retry = %d, %v, replayed %v; want only the retryable message", n, err, replayed)
	}
	if open := e.count(t, `SELECT count(*) FROM consumer_failures WHERE resolved_at IS NULL AND abandoned_at IS NULL`); open != 0 {
		t.Fatalf("%d failures still open", open)
	}
}

func TestAFailureThatKeepsFailingIsAbandonedAfterItsAttempts(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	if err := e.s.RecordFailure(ctx, bus.Failed{Event: bus.EventDelivery, RequestID: "r1", Raw: []byte(`{}`), Cause: errString("x")}); err != nil {
		t.Fatal(err)
	}
	always := func(context.Context, []byte) error { return errString("still broken") }
	for i := 0; i < 6; i++ {
		e.exec(t, `UPDATE consumer_failures SET next_attempt_at = now() - interval '1 second' WHERE abandoned_at IS NULL`)
		if _, err := e.s.RetryFailures(ctx, always); err != nil {
			t.Fatal(err)
		}
	}
	if n := e.count(t, `SELECT count(*) FROM consumer_failures WHERE abandoned_at IS NOT NULL`); n != 1 {
		t.Fatalf("%d abandoned; want the failure to stop retrying", n)
	}
}

// A transition for a monitor deleted meanwhile must not abort the consumer's
// transaction.
func TestTransitionForADeletedMonitorIsDropped(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	m, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Gone"), Target: ptr("https://gone.example.com")})
	raw := transition(m, c.OrgID, 1, "pending", "down")
	if err := e.s.DeleteMonitor(ctx, c, m.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.s.OnTransition(ctx, raw); err != nil {
		t.Fatalf("transition for a deleted monitor: %v; want it dropped without an error", err)
	}
}

type errString string

func (e errString) Error() string { return string(e) }
