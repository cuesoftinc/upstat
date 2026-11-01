package service

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/netip"
	"net/url"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
)

// ── Monitors (flows/monitor.md §1) ──────────────────────────────────────

var monitorTypes = map[string]bool{"website": true, "server": true, "api": true, "blog": true}

// MonitorInput is a create or a patch; nil leaves a field alone.
type MonitorInput struct {
	Name              *string   `json:"name"`
	Target            *string   `json:"target"`
	Type              *string   `json:"type"`
	Active            *bool     `json:"active"`
	Muted             *bool     `json:"muted"`
	IntervalSeconds   *int      `json:"interval_seconds"`
	TimeoutSeconds    *int      `json:"timeout_seconds"`
	FailureThreshold  *int      `json:"failure_threshold"`
	Regions           *[]string `json:"regions"`
	MinFailingRegions *int      `json:"min_failing_regions"`
}

// blockedTarget refuses literal private, loopback, link-local, CGNAT,
// metadata and IPv6 ULA addresses, and localhost names, at save time. The
// probe re-checks every resolved IP at check time (§8, DNS rebinding).
func blockedTarget(host string) bool {
	h := strings.ToLower(strings.TrimSuffix(host, "."))
	if h == "localhost" || strings.HasSuffix(h, ".localhost") || h == "metadata.google.internal" || strings.HasSuffix(h, ".internal") {
		return true
	}
	addr, err := netip.ParseAddr(strings.Trim(h, "[]"))
	if err != nil {
		return false
	}
	addr = addr.Unmap()
	cgnat := netip.MustParsePrefix("100.64.0.0/10")
	return addr.IsLoopback() || addr.IsPrivate() || addr.IsLinkLocalUnicast() || addr.IsLinkLocalMulticast() ||
		addr.IsUnspecified() || addr.IsMulticast() || cgnat.Contains(addr)
}

func (s *Services) validateTarget(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return invalid("invalid_target", "target must be an absolute http(s) URL")
	}
	if u.User != nil {
		return invalid("invalid_target", "target URLs may not carry credentials")
	}
	if !s.Config.SelfHost && blockedTarget(u.Hostname()) {
		return invalid("target_not_allowed", "private, loopback and metadata addresses can't be monitored")
	}
	return nil
}

func (s *Services) checkMonitor(m *model.Monitor) error {
	m.Name = strings.TrimSpace(m.Name)
	if m.Name == "" || len(m.Name) > 80 {
		return invalid("bad_shape", "name must be 1-80 characters")
	}
	if err := s.validateTarget(m.Target); err != nil {
		return err
	}
	if !monitorTypes[m.Type] {
		return invalid("bad_shape", "type must be website, server, api or blog")
	}
	// The scheduler runs once a minute, so 60 s is the shortest interval
	// (system-design.md §6.1).
	if m.IntervalSeconds < 60 || m.IntervalSeconds > 86400 {
		return invalid("invalid_interval", "interval must be between 60 seconds and 24 hours")
	}
	if m.TimeoutSeconds < 1 || m.TimeoutSeconds > 60 {
		return invalid("invalid_timeout", "timeout must be between 1 and 60 seconds")
	}
	if m.TimeoutSeconds >= m.IntervalSeconds {
		return invalid("timeout_gte_interval", "timeout must be below the check interval")
	}
	if m.FailureThreshold < 1 || m.FailureThreshold > 10 {
		return invalid("invalid_threshold", "failure threshold must be between 1 and 10")
	}
	known := s.Config.Regions()
	for _, r := range m.Regions {
		found := false
		for _, k := range known {
			found = found || k == r
		}
		if !found {
			return invalid("invalid_region", "unknown probe region "+r)
		}
	}
	if m.MinFailingRegions < 1 {
		return invalid("bad_shape", "min_failing_regions must be at least 1")
	}
	return nil
}

func (s *Services) ListMonitors(ctx context.Context, c *Caller) ([]model.Monitor, error) {
	var out []model.Monitor
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListMonitors(ctx, tx)
		return err
	})
	for i := range out {
		s.lazyNodata(&out[i])
	}
	return out, err
}

// lazyNodata keeps the UI honest when nothing reports (flows/monitor.md
// §2): a monitor with no completed check for 2×interval reads nodata even
// before the evaluator materializes it.
func (s *Services) lazyNodata(m *model.Monitor) {
	if !m.Active || m.Status == "pending" || m.LastCheckedAt == nil {
		return
	}
	if s.Now().Sub(*m.LastCheckedAt) > 2*time.Duration(m.IntervalSeconds)*time.Second {
		m.Status = "nodata"
	}
}

func (s *Services) GetMonitor(ctx context.Context, c *Caller, id string) (*model.Monitor, error) {
	var out *model.Monitor
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.GetMonitor(ctx, tx, id)
		return orNotFound(err, "monitor")
	})
	if out != nil {
		s.lazyNodata(out)
	}
	return out, err
}

func deref[T any](p *T, fallback T) T {
	if p == nil {
		return fallback
	}
	return *p
}

func (s *Services) CreateMonitor(ctx context.Context, c *Caller, in MonitorInput) (*model.Monitor, error) {
	if in.Name == nil || in.Target == nil {
		return nil, invalid("bad_shape", "name and target are required")
	}
	regions := deref(in.Regions, []string{})
	m := model.Monitor{
		Name: *in.Name, Target: strings.TrimSpace(*in.Target), Type: deref(in.Type, "website"),
		IntervalSeconds: deref(in.IntervalSeconds, 60), TimeoutSeconds: deref(in.TimeoutSeconds, 10),
		FailureThreshold: deref(in.FailureThreshold, 3), Regions: regions,
		MinFailingRegions: deref(in.MinFailingRegions, s.defaultQuorum(regions)),
	}
	if err := s.checkMonitor(&m); err != nil {
		return nil, err
	}
	var out *model.Monitor
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		n, err := repository.CountMonitors(ctx, tx)
		if err != nil {
			return err
		}
		if n >= s.Config.MonitorCapPerOrg {
			return invalid("monitor_limit", "this org has reached its monitor limit")
		}
		out, err = repository.CreateMonitor(ctx, tx, c.OrgID, m)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a monitor with this name exists")
		}
		if err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindMonitors)
	})
	return out, err
}

// defaultQuorum is min_failing_regions = 2 of 2 (S-5), capped by how many
// regions the monitor uses.
func (s *Services) defaultQuorum(regions []string) int {
	n := len(regions)
	if n == 0 {
		n = len(s.Config.Probes)
	}
	return max(1, min(2, n))
}

func (s *Services) UpdateMonitor(ctx context.Context, c *Caller, id string, in MonitorInput) (*model.Monitor, error) {
	var out *model.Monitor
	err := s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		cur, err := repository.GetMonitor(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "monitor")
		}
		next := *cur
		next.Name = deref(in.Name, cur.Name)
		next.Target = strings.TrimSpace(deref(in.Target, cur.Target))
		next.Type = deref(in.Type, cur.Type)
		next.IntervalSeconds = deref(in.IntervalSeconds, cur.IntervalSeconds)
		next.TimeoutSeconds = deref(in.TimeoutSeconds, cur.TimeoutSeconds)
		next.FailureThreshold = deref(in.FailureThreshold, cur.FailureThreshold)
		next.Regions = deref(in.Regions, cur.Regions)
		next.MinFailingRegions = deref(in.MinFailingRegions, cur.MinFailingRegions)
		if err := s.checkMonitor(&next); err != nil {
			return err
		}
		patch := repository.MonitorPatch{Name: in.Name, Target: in.Target, Type: in.Type, Active: in.Active, Muted: in.Muted,
			IntervalSeconds: in.IntervalSeconds, TimeoutSeconds: in.TimeoutSeconds, Threshold: in.FailureThreshold,
			Regions: in.Regions, MinFailingRegions: in.MinFailingRegions}
		if in.Name != nil {
			patch.Name = &next.Name
		}
		if in.Target != nil {
			patch.Target = &next.Target
		}
		out, err = repository.UpdateMonitor(ctx, tx, id, patch)
		if errors.Is(err, repository.ErrConflict) {
			return conflict("name_taken", "a monitor with this name exists")
		}
		if err != nil {
			return err
		}
		// Pausing closes an open incident as resolved: paused (§2).
		if in.Active != nil && !*in.Active && cur.Active {
			if err := s.closeMonitorIncident(ctx, tx, id, "Resolved: monitor paused"); err != nil {
				return err
			}
		}
		return configChanged(ctx, tx, snapshot.KindMonitors)
	})
	return out, err
}

func (s *Services) DeleteMonitor(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "member", func(tx pgx.Tx) error {
		if err := repository.DeleteMonitor(ctx, tx, id); err != nil {
			return orNotFound(err, "monitor")
		}
		return configChanged(ctx, tx, snapshot.KindMonitors)
	})
}

// MonitorHistory is the 90-day strip and recent checks (B7), read from the
// telemetry plane.
func (s *Services) MonitorHistory(ctx context.Context, c *Caller, id string) (map[string]any, error) {
	if _, err := s.GetMonitor(ctx, c, id); err != nil {
		return nil, err
	}
	return s.Telemetry.History(ctx, c.OrgID, id)
}

func (s *Services) MonitorInsights(ctx context.Context, c *Caller, id string) ([]model.Insight, error) {
	var out []model.Insight
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) error {
		if _, err := repository.GetMonitor(ctx, tx, id); err != nil {
			return orNotFound(err, "monitor")
		}
		var err error
		out, err = repository.ListInsights(ctx, tx, id, 20)
		return err
	})
	return out, err
}

// ── Ingest keys (data-model.md §5; rotation keeps the old key 24 h) ─────

const rotationGrace = 24 * time.Hour

var keyScopes = map[string]bool{"otlp": true, "rum": true, "statsd": true, "all": true}

// newKey returns a key's plaintext, its sha256 and its masked form.
func newKey(kind string) (plain, hash, masked string) {
	prefix := "uk_live"
	if kind == "property_key" {
		prefix = "pk_live"
	}
	buf := make([]byte, 16)
	_, _ = rand.Read(buf)
	body := hex.EncodeToString(buf)
	plain = prefix + "_" + body
	return plain, HashKey(plain), prefix + "_" + body[:4] + "…" + body[len(body)-4:]
}

// HashKey is how ingest keys are stored and looked up (hex sha256).
func HashKey(plain string) string {
	sum := sha256.Sum256([]byte(plain))
	return hex.EncodeToString(sum[:])
}

func cleanOrigins(origins []string) ([]string, error) {
	out := []string{}
	for _, o := range origins {
		u, err := url.Parse(strings.TrimSpace(o))
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.Path != "" && u.Path != "/" {
			return nil, invalid("invalid_origin", "allowed origins are scheme://host[:port]")
		}
		out = append(out, u.Scheme+"://"+u.Host)
	}
	return out, nil
}

func (s *Services) ListKeys(ctx context.Context, c *Caller) ([]model.APIKey, error) {
	var out []model.APIKey
	err := s.inOrg(ctx, c, "admin", func(tx pgx.Tx) (err error) {
		out, err = repository.ListKeys(ctx, tx)
		return err
	})
	return out, err
}

type KeyInput struct {
	Kind           string    `json:"kind"`
	Name           string    `json:"name"`
	Scope          string    `json:"scope"`
	AllowedOrigins *[]string `json:"allowed_origins"`
}

func (s *Services) CreateKey(ctx context.Context, c *Caller, in KeyInput) (*model.APIKey, error) {
	if (in.Kind != "ingestion_token" && in.Kind != "property_key") || strings.TrimSpace(in.Name) == "" || !keyScopes[in.Scope] {
		return nil, invalid("bad_shape", "kind, name and scope are required")
	}
	origins, err := cleanOrigins(deref(in.AllowedOrigins, nil))
	if err != nil {
		return nil, err
	}
	plain, hash, masked := newKey(in.Kind)
	var out *model.APIKey
	err = s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		var err error
		if out, err = repository.CreateKey(ctx, tx, c.OrgID, in.Kind, strings.TrimSpace(in.Name), in.Scope, hash, masked, origins); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindIngestKeys)
	})
	if out != nil {
		out.Key = plain
	}
	return out, err
}

func (s *Services) RotateKey(ctx context.Context, c *Caller, id string) (*model.APIKey, error) {
	var out *model.APIKey
	var plain string
	err := s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		cur, err := repository.GetKey(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "key")
		}
		if cur.Status == "revoked" {
			return conflict("already_revoked", "cannot rotate a revoked key")
		}
		var hash, masked string
		plain, hash, masked = newKey(cur.Kind)
		if out, err = repository.RotateKey(ctx, tx, id, hash, masked, rotationGrace); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindIngestKeys)
	})
	if out != nil {
		out.Key = plain
	}
	return out, err
}

func (s *Services) RevokeKey(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		cur, err := repository.GetKey(ctx, tx, id)
		if err != nil {
			return orNotFound(err, "key")
		}
		if cur.Status == "revoked" {
			return conflict("already_revoked", "key is already revoked")
		}
		if err := repository.RevokeKey(ctx, tx, id); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindIngestKeys)
	})
}

func (s *Services) SetKeyOrigins(ctx context.Context, c *Caller, id string, origins []string) (*model.APIKey, error) {
	clean, err := cleanOrigins(origins)
	if err != nil {
		return nil, err
	}
	var out *model.APIKey
	err = s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		var err error
		if out, err = repository.UpdateKeyOrigins(ctx, tx, id, clean); err != nil {
			return orNotFound(err, "key")
		}
		return configChanged(ctx, tx, snapshot.KindIngestKeys)
	})
	return out, err
}

// ── Event registry (api.md §3.4a: the registry is the ingest schema) ────

// browserDims are page_view's closed vocabulary, admitted on every event.
var browserDims = map[string]bool{"path": true, "referrer_host": true, "device_class": true, "country": true}

func (s *Services) ListRegistry(ctx context.Context, c *Caller) ([]model.RegistryEvent, error) {
	var out []model.RegistryEvent
	err := s.inOrg(ctx, c, "viewer", func(tx pgx.Tx) (err error) {
		out, err = repository.ListRegistry(ctx, tx)
		return err
	})
	return out, err
}

func (s *Services) RegisterEvent(ctx context.Context, c *Caller, e model.RegistryEvent) (*model.RegistryEvent, error) {
	e.Name = strings.TrimSpace(e.Name)
	if !validEventName(e.Name) {
		return nil, invalid("bad_shape", "event names are lowercase snake_case, up to 64 characters")
	}
	if e.Dims == nil {
		e.Dims = []string{}
	}
	for _, d := range e.Dims {
		if !validEventName(d) || browserDims[d] {
			return nil, invalid("bad_shape", "dims are snake_case and may not repeat the browser dims")
		}
	}
	var out *model.RegistryEvent
	err := s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		var err error
		if out, err = repository.UpsertRegistry(ctx, tx, c.OrgID, e); err != nil {
			return err
		}
		return configChanged(ctx, tx, snapshot.KindRegistry)
	})
	return out, err
}

func (s *Services) UnregisterEvent(ctx context.Context, c *Caller, id string) error {
	return s.inOrg(ctx, c, "admin", func(tx pgx.Tx) error {
		if err := repository.DeleteRegistry(ctx, tx, id); err != nil {
			return orNotFound(err, "event")
		}
		return configChanged(ctx, tx, snapshot.KindRegistry)
	})
}

func validEventName(s string) bool {
	if s == "" || len(s) > 64 || s[0] < 'a' || s[0] > 'z' {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r == '_') {
			return false
		}
	}
	return true
}
