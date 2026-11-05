package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	kgo "github.com/segmentio/kafka-go"

	"github.com/cuesoftinc/upstat/api/common/internal/auth"
	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/outbox"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/migrations"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
	"github.com/cuesoftinc/upstat/api/common/pkg/testenv"
)

// These tests run against a real Postgres (TEST_DATABASE_URL, a superuser
// URL). Each test gets a fresh database owned by a non-superuser role, so
// row-level security is enforced as in production.

type fakeProber struct {
	mu    sync.Mutex
	calls []string
	fail  map[string]bool
	// onCheck runs inside each probe call, before it answers.
	onCheck func()
}

func (p *fakeProber) Check(_ context.Context, region string, req service.CheckRequest) (*service.CheckResponse, error) {
	if p.onCheck != nil {
		p.onCheck()
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, region+" "+req.Target)
	if p.fail[region] {
		return nil, errors.New("probe unreachable")
	}
	return &service.CheckResponse{OK: true, StatusCode: 200, TotalMs: 123}, nil
}

func (p *fakeProber) Run(context.Context, string, service.RunRequest) (*service.RunResponse, error) {
	return &service.RunResponse{Steps: []model.SyntheticStepResult{{Index: 1, Kind: "http", Summary: "GET https://example.com", Status: "pass", DurationMs: 50}}}, nil
}

type fakeResults struct{ sent []service.CheckResult }

func (r *fakeResults) Send(_ context.Context, rs []service.CheckResult) error {
	r.sent = append(r.sent, rs...)
	return nil
}

type fakeTelemetry struct{}

func (fakeTelemetry) History(context.Context, string, string) (map[string]any, error) {
	return map[string]any{}, nil
}
func (fakeTelemetry) Uptime(_ context.Context, _ string, ids []string, _ int) (map[string]service.UptimeSummary, error) {
	out := map[string]service.UptimeSummary{}
	for _, id := range ids {
		p := 99.5
		out[id] = service.UptimeSummary{Days: []model.UptimeDay{}, UptimePct: &p}
	}
	return out, nil
}
func (fakeTelemetry) HasData(context.Context, string) (bool, error) { return true, nil }
func (fakeTelemetry) Presence(context.Context, string, []string) (map[string]service.Presence, error) {
	return map[string]service.Presence{}, nil
}
func (fakeTelemetry) Replay(context.Context, string, service.ReplayRequest) (map[string]any, error) {
	return map[string]any{}, nil
}

type env struct {
	s       *service.Services
	db      *repository.DB
	blobs   *store.Memory
	prober  *fakeProber
	results *fakeResults
}

func newEnv(t *testing.T) *env {
	t.Helper()
	admin := testenv.Require(t, "TEST_DATABASE_URL")
	ctx := context.Background()
	root, err := pgxpool.New(ctx, admin)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	name := fmt.Sprintf("upstat_test_%d", rand.Int63())
	for _, stmt := range []string{
		`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'upstat_app') THEN CREATE ROLE upstat_app LOGIN PASSWORD 'app'; END IF; END $$`,
		`CREATE DATABASE ` + name + ` OWNER upstat_app`,
	} {
		if _, err := root.Exec(ctx, stmt); err != nil {
			t.Fatal(err)
		}
	}
	t.Cleanup(func() {
		r, err := pgxpool.New(context.Background(), admin)
		if err == nil {
			_, _ = r.Exec(context.Background(), `DROP DATABASE IF EXISTS `+name+` WITH (FORCE)`)
			r.Close()
		}
	})
	url := strings.Replace(strings.Replace(admin, "postgres:postgres@", "upstat_app:app@", 1), "/postgres?", "/"+name+"?", 1)
	db, err := repository.Open(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(db.Close)
	if err := migrations.Apply(ctx, db.Pool); err != nil {
		t.Fatal(err)
	}
	blobs := store.NewMemory("upstat/test")
	prober := &fakeProber{fail: map[string]bool{}}
	results := &fakeResults{}
	cfg := &config.Config{Probes: map[string]string{"us-central1": "http://p1", "us-east4": "http://p2"}, MonitorCapPerOrg: 5}
	return &env{s: service.New(db, blobs, cfg, prober, fakeTelemetry{}, results), db: db, blobs: blobs, prober: prober, results: results}
}

// signIn creates a user and returns them as a caller with their active org.
func (e *env) signIn(t *testing.T, email string) *service.Caller {
	t.Helper()
	ctx := context.Background()
	users := service.AuthUsers{S: e.s}
	if err := users.CreateUser(ctx, authUser(email)); err != nil {
		t.Fatal(err)
	}
	u, err := users.GetUser(ctx, email)
	if err != nil {
		t.Fatal(err)
	}
	c, err := e.s.CallerFor(ctx, u.ID)
	if err != nil {
		t.Fatal(err)
	}
	return c
}

func (e *env) refresh(t *testing.T, c *service.Caller) *service.Caller {
	t.Helper()
	n, err := e.s.CallerFor(context.Background(), c.UserID)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func (e *env) withOrg(t *testing.T, email, org string) *service.Caller {
	t.Helper()
	c := e.signIn(t, email)
	if _, err := e.s.CreateOrg(context.Background(), c, org, "Africa/Lagos"); err != nil {
		t.Fatal(err)
	}
	return e.refresh(t, c)
}

func code(err error) string {
	var se *service.Error
	if errors.As(err, &se) {
		return se.Code
	}
	if err != nil {
		return "error: " + err.Error()
	}
	return ""
}

func ptr[T any](v T) *T { return &v }

func TestTenancyAndMonitorRules(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	ada := e.withOrg(t, "ada@example.com", "Acme")
	bob := e.withOrg(t, "bob@example.com", "Bobco")

	m, err := e.s.CreateMonitor(ctx, ada, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")})
	if err != nil {
		t.Fatal(err)
	}
	if m.Status != "pending" || m.MinFailingRegions != 2 || m.IntervalSeconds != 60 {
		t.Fatalf("defaults: %+v", m)
	}
	if _, err := e.s.GetMonitor(ctx, bob, m.ID); code(err) != "not_found" {
		t.Fatalf("cross-org read: %v", err)
	}
	if list, _ := e.s.ListMonitors(ctx, bob); len(list) != 0 {
		t.Fatalf("bob sees %d monitors", len(list))
	}
	// Row-level security holds even if the repository forgot the org.
	_ = e.db.AsOrg(ctx, bob.OrgID, func(tx pgx.Tx) error {
		if _, err := repository.GetMonitor(ctx, tx, m.ID); !errors.Is(err, repository.ErrNotFound) {
			t.Fatalf("RLS let another org read the row: %v", err)
		}
		return nil
	})

	cases := []struct {
		in   service.MonitorInput
		want string
	}{
		{service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")}, "name_taken"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("https://example.com"), TimeoutSeconds: ptr(60), IntervalSeconds: ptr(60)}, "timeout_gte_interval"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("https://user:pass@example.com")}, "invalid_target"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("http://169.254.169.254/latest")}, "target_not_allowed"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("http://10.0.0.5")}, "target_not_allowed"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("ftp://example.com")}, "invalid_target"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("https://example.com"), IntervalSeconds: ptr(30)}, "invalid_interval"},
		{service.MonitorInput{Name: ptr("t"), Target: ptr("https://example.com"), Regions: ptr([]string{"mars"})}, "invalid_region"},
	}
	for _, tc := range cases {
		if _, err := e.s.CreateMonitor(ctx, ada, tc.in); code(err) != tc.want {
			t.Errorf("%+v: got %q, want %q", tc.in, code(err), tc.want)
		}
	}

	// Pausing freezes status at paused; resuming starts from pending.
	paused, err := e.s.UpdateMonitor(ctx, ada, m.ID, service.MonitorInput{Active: ptr(false)})
	if err != nil || paused.Status != "paused" {
		t.Fatalf("pause: %v %+v", err, paused)
	}
	resumed, err := e.s.UpdateMonitor(ctx, ada, m.ID, service.MonitorInput{Active: ptr(true)})
	if err != nil || resumed.Status != "pending" {
		t.Fatalf("resume: %v %+v", err, resumed)
	}
}

func TestRolesAndInvites(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	owner := e.withOrg(t, "owner@example.com", "Acme")
	if _, err := e.s.InviteMember(ctx, owner, "viewer@example.com", "viewer"); err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.InviteMember(ctx, owner, "viewer@example.com", "viewer"); code(err) != "already_member" {
		t.Fatalf("duplicate invite: %v", err)
	}
	viewer := e.signIn(t, "viewer@example.com")
	if viewer.OrgID != owner.OrgID || viewer.Role != "viewer" {
		t.Fatalf("invite not claimed on sign-in: %+v", viewer)
	}
	if _, err := e.s.CreateMonitor(ctx, viewer, service.MonitorInput{Name: ptr("x"), Target: ptr("https://example.com")}); code(err) != "forbidden" {
		t.Fatalf("viewer created a monitor: %v", err)
	}
	if _, err := e.s.ListMonitors(ctx, viewer); err != nil {
		t.Fatalf("viewer can't read: %v", err)
	}
	members, _ := e.s.ListMembers(ctx, owner)
	var ownerRow string
	for _, m := range members {
		if m.Role == "owner" {
			ownerRow = m.ID
		}
	}
	if err := e.s.RemoveMember(ctx, owner, ownerRow); code(err) != "last_owner" {
		t.Fatalf("removed the last owner: %v", err)
	}
	stranger := e.signIn(t, "nobody@example.com")
	if _, err := e.s.ListMonitors(ctx, stranger); code(err) != "not_found" {
		t.Fatalf("no-org caller: %v", err)
	}
}

func TestRunChecksRelaysEachRegion(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	m, err := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")})
	if err != nil {
		t.Fatal(err)
	}
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE monitors SET next_run_at = now() - interval '5 seconds'`)
		return err
	})
	e.prober.fail["us-east4"] = true
	if err := e.s.RunChecks(ctx); err != nil {
		t.Fatal(err)
	}
	if len(e.prober.calls) != 2 {
		t.Fatalf("probe calls %v", e.prober.calls)
	}
	var results []map[string]any
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		rows, _ := tx.Query(ctx, `SELECT payload FROM outbox WHERE event = $1 ORDER BY id`, bus.EventSyntheticResult)
		defer rows.Close()
		for rows.Next() {
			var raw []byte
			_ = rows.Scan(&raw)
			var p map[string]any
			_ = json.Unmarshal(raw, &p)
			results = append(results, p)
		}
		return nil
	})
	missing := 0
	for _, r := range results {
		if r["missing"] == true {
			missing++
		}
	}
	if len(results) != 2 || missing != 1 || len(e.results.sent) != 1 {
		t.Fatalf("results %v, telemetry %d", results, len(e.results.sent))
	}
	got, _ := e.s.GetMonitor(ctx, c, m.ID)
	if got.LastCheckedAt == nil || got.LastResponseTimeMs == nil || *got.LastResponseTimeMs != 123 {
		t.Fatalf("last check not recorded: %+v", got)
	}
	e.prober.calls = nil
	if err := e.s.RunChecks(ctx); err != nil || len(e.prober.calls) != 0 {
		t.Fatalf("a second pass re-ran the same slot: %v %v", err, e.prober.calls)
	}
}

func transition(m *model.Monitor, org string, seq int, from, to string) json.RawMessage {
	raw, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "monitor_id": m.ID, "org_id": org, "seq": seq, "from": from, "to": to,
		"cause": "timeout", "at": time.Now().UTC(), "regions": map[string]bool{"us-central1": false}, "consecutive_failures": 3})
	return raw
}

func TestTransitionsOpenAndCloseIncidents(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	m, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")})

	down := transition(m, c.OrgID, 1, "pending", "down")
	for range 2 { // a redelivery changes nothing
		if err := e.s.OnTransition(ctx, down); err != nil {
			t.Fatal(err)
		}
	}
	incidents, _ := e.s.ListIncidents(ctx, c)
	if len(incidents) != 1 || incidents[0].Key != "INC-1" || incidents[0].Source != "monitor" || incidents[0].Status != "investigating" {
		t.Fatalf("incidents %+v", incidents)
	}
	got, _ := e.s.GetMonitor(ctx, c, m.ID)
	if got.Status != "down" || got.ConsecutiveFailures != 3 {
		t.Fatalf("status not materialized: %+v", got)
	}
	// An older transition arriving late doesn't roll the status back.
	if err := e.s.OnTransition(ctx, transition(m, c.OrgID, 0+1, "pending", "up")); err != nil {
		t.Fatal(err)
	}
	if err := e.s.OnTransition(ctx, transition(m, c.OrgID, 2, "down", "up")); err != nil {
		t.Fatal(err)
	}
	inc, _ := e.s.GetIncident(ctx, c, incidents[0].ID)
	if inc.Status != "resolved" || inc.ResolvedAt == nil {
		t.Fatalf("incident not closed: %+v", inc)
	}
	tl, _ := e.s.Timeline(ctx, c, inc.ID)
	if len(tl) != 2 {
		t.Fatalf("timeline %+v", tl)
	}
	pm, created, err := e.s.SavePostmortem(ctx, c, inc.ID, service.PostmortemInput{Author: "Ada", Impact: ptr("Down 5m"),
		RootCause: ptr("DNS"), ActionItems: []string{"Add a second resolver", " "}})
	if err != nil || !created || len(pm.ActionItems) != 1 || len(pm.Timeline) != 2 {
		t.Fatalf("postmortem: %v %+v", err, pm)
	}
	if got, err := e.s.GetPostmortem(ctx, c, inc.ID); err != nil || got.RootCause != "DNS" {
		t.Fatalf("postmortem read: %v", err)
	}
}

func TestDeliveriesDriveTheFeedAndChannelHealth(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	ch, err := e.s.CreateChannel(ctx, c, service.ChannelInput{Kind: "webhook", Target: "https://hooks.example.com/x"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.CreateRule(ctx, c, service.RuleInput{Name: ptr("Down"), Signal: ptr("uptime"), Thresholds: &model.Thresholds{Crit: 1},
		Notify: &model.Notify{ChannelIDs: []string{ch.ID}}}); code(err) != "channel_unverified" {
		t.Fatalf("rule on an unverified channel: %v", err)
	}
	if _, err := e.s.VerifyChannel(ctx, c, ch.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := e.s.VerifyChannel(ctx, c, ch.ID); code(err) != "rate_limited" {
		t.Fatalf("second verify: %v", err)
	}
	deliver := func(kind, state string) {
		raw, _ := json.Marshal(map[string]any{"id": uuid.NewString(), "org_id": c.OrgID, "kind": kind, "channel_id": ch.ID, "state": state,
			"attempts": 4, "at": time.Now().UTC(), "sev": "sev1", "monitor_name": "Homepage", "message": "Homepage is down"})
		if err := e.s.OnDelivery(ctx, raw); err != nil {
			t.Fatal(err)
		}
	}
	deliver("verify", "delivered")
	got, _ := e.s.GetChannel(ctx, c, ch.ID)
	if got.Health != "verified" {
		t.Fatalf("verify: %+v", got)
	}
	for range 5 {
		deliver("alert", "failed")
	}
	got, _ = e.s.GetChannel(ctx, c, ch.ID)
	if got.Health != "degraded" || got.FailureNote == "" {
		t.Fatalf("five failures: %+v", got)
	}
	deliver("alert", "delivered")
	got, _ = e.s.GetChannel(ctx, c, ch.ID)
	if got.Health != "verified" {
		t.Fatalf("recovered: %+v", got)
	}
	feed, _ := e.s.AlertFeed(ctx, c)
	if len(feed) != 6 {
		t.Fatalf("feed has %d rows", len(feed))
	}
}

type sender struct {
	p    *bus.Producer
	sent []kgo.Message
}

func (s *sender) Message(ctx context.Context, event, key, requestID string, data json.RawMessage) (kgo.Message, error) {
	return s.p.Message(ctx, event, key, requestID, data)
}

func (s *sender) Write(_ context.Context, msgs ...kgo.Message) error {
	s.sent = append(s.sent, msgs...)
	return nil
}

func TestOutboxPublishesValidMessagesAndSnapshots(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	key, err := e.s.CreateKey(ctx, c, service.KeyInput{Kind: "ingestion_token", Name: "prod", Scope: "otlp"})
	if err != nil || !strings.HasPrefix(key.Key, "uk_live_") {
		t.Fatalf("key: %v %+v", err, key)
	}
	m, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("Homepage"), Target: ptr("https://example.com")})
	_ = e.db.AsSystem(ctx, func(tx pgx.Tx) error {
		_, err := tx.Exec(ctx, `UPDATE monitors SET next_run_at = now() - interval '1 second'`)
		return err
	})
	if err := e.s.RunChecks(ctx); err != nil {
		t.Fatal(err)
	}
	contract, err := bus.LoadContract()
	if err != nil {
		t.Fatal(err)
	}
	producer, _ := bus.NewProducer(bus.Config{Brokers: []string{"localhost:1"}}, contract, e.blobs)
	snd := &sender{p: producer}
	pub := &outbox.Publisher{DB: e.db, Producer: snd, Store: e.blobs, Interval: time.Second, Now: time.Now}
	for {
		n, err := pub.PublishBatch(ctx)
		if err != nil {
			t.Fatal(err)
		}
		if n == 0 {
			break
		}
	}
	events := map[string]int{}
	for _, msg := range snd.sent {
		var env bus.Envelope
		_ = json.Unmarshal(msg.Value, &env)
		events[env.Type]++
		if env.DataRef == nil {
			t.Fatalf("%s went inline", env.Type)
		}
	}
	if events[bus.EventSyntheticResult] != 2 || events[bus.EventConfigChanged] == 0 {
		t.Fatalf("published %v", events)
	}
	keys, _, err := snapshot.Read[snapshot.IngestKey](ctx, e.blobs, snapshot.KindIngestKeys)
	if err != nil || len(keys) != 1 || keys[0].Hash != service.HashKey(key.Key) || keys[0].OrgID != c.OrgID {
		t.Fatalf("ingest key snapshot: %v %+v", err, keys)
	}
	mons, _, _ := snapshot.Read[snapshot.Monitor](ctx, e.blobs, snapshot.KindMonitors)
	if len(mons) != 1 || mons[0].ID != m.ID || mons[0].MinFailingRegions != 2 {
		t.Fatalf("monitor snapshot %+v", mons)
	}
	// Rotation keeps the old hash for 24 h; revocation drops the key.
	rotated, _ := e.s.RotateKey(ctx, c, key.ID)
	if rotated.Status != "rotation_grace" || rotated.Key == key.Key {
		t.Fatalf("rotate %+v", rotated)
	}
	if err := e.s.RevokeKey(ctx, c, key.ID); err != nil {
		t.Fatal(err)
	}
	if err := e.s.RevokeKey(ctx, c, key.ID); code(err) != "already_revoked" {
		t.Fatalf("double revoke: %v", err)
	}
}

func TestPublicStatusPage(t *testing.T) {
	e := newEnv(t)
	ctx := context.Background()
	c := e.withOrg(t, "ada@example.com", "Acme")
	m, _ := e.s.CreateMonitor(ctx, c, service.MonitorInput{Name: ptr("API"), Target: ptr("https://api.example.com")})
	if _, err := e.s.SaveStatusPage(ctx, c, model.StatusPageConfig{Name: "Acme status", Slug: "Bad Slug"}); code(err) != "invalid_slug" {
		t.Fatalf("slug: %v", err)
	}
	if _, err := e.s.SaveStatusPage(ctx, c, model.StatusPageConfig{Name: "Acme status", Slug: "acme",
		Components: []model.StatusComponentConfig{{ID: "draft_1", Name: "API", MonitorID: &m.ID}}}); err != nil {
		t.Fatal(err)
	}
	other := e.withOrg(t, "bob@example.com", "Bobco")
	if _, err := e.s.SaveStatusPage(ctx, other, model.StatusPageConfig{Name: "Bob", Slug: "acme"}); code(err) != "slug_taken" {
		t.Fatalf("slug taken: %v", err)
	}
	_ = e.s.OnTransition(ctx, transition(m, c.OrgID, 1, "pending", "down"))
	page, err := e.s.PublicStatusPage(ctx, "acme")
	if err != nil {
		t.Fatal(err)
	}
	if page.Overall != "major_outage" || len(page.Components) != 1 || page.Components[0].UptimePct == nil || len(page.Incidents) != 1 {
		t.Fatalf("page %+v", page)
	}
	if _, err := e.s.PublicStatusPage(ctx, "nope"); code(err) != "not_found" {
		t.Fatalf("unknown slug: %v", err)
	}
}

func authUser(email string) auth.User {
	return auth.User{Email: email, Name: strings.Split(email, "@")[0]}
}
