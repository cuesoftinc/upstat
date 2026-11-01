// Package snapshot is config propagation (system-design.md §6.8, as amended
// by X-11): common rewrites one JSON object per config kind under
// upstat/<env>/config/<kind>.json and publishes upstat.config.changed.
// Readers load every kind they need on start and reload one on the event;
// nobody but common touches Postgres.
package snapshot

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

// Kinds, as the contract's config_kind enum names them.
const (
	KindOrgs       = "orgs"
	KindMembers    = "members"
	KindIngestKeys = "ingest_keys"
	KindMonitors   = "monitors"
	KindRules      = "rules"
	KindChannels   = "channels"
	KindRegistry   = "registry"
	KindSLOs       = "slos"
)

// AllKinds is every kind common keeps a snapshot of.
var AllKinds = []string{KindOrgs, KindMembers, KindIngestKeys, KindMonitors, KindRules, KindChannels, KindRegistry, KindSLOs}

// Document is the object at config/<kind>.json.
type Document struct {
	Kind    string          `json:"kind"`
	Version int64           `json:"version"`
	Items   json.RawMessage `json:"items"`
}

type Org struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Timezone string `json:"timezone"`
}

type Membership struct {
	OrgID string `json:"org_id"`
	Role  string `json:"role"`
}

// UserAccess is one user's active memberships and active org (members kind).
type UserAccess struct {
	UserID      string       `json:"user_id"`
	ActiveOrgID string       `json:"active_org_id"`
	Memberships []Membership `json:"memberships"`
}

type IngestKey struct {
	ID                string             `json:"id"`
	OrgID             string             `json:"org_id"`
	Kind              string             `json:"kind"`
	Scope             string             `json:"scope"`
	Hash              string             `json:"hash"`
	PreviousHash      string             `json:"previous_hash,omitempty"`
	PreviousExpiresAt *time.Time         `json:"previous_expires_at,omitempty"`
	Status            string             `json:"status"`
	AllowedOrigins    []string           `json:"allowed_origins"`
	Quotas            map[string]float64 `json:"quotas"`
}

type Monitor struct {
	ID                  string   `json:"id"`
	OrgID               string   `json:"org_id"`
	Name                string   `json:"name"`
	Target              string   `json:"target"`
	IntervalS           int      `json:"interval_s"`
	TimeoutS            int      `json:"timeout_s"`
	FailureThreshold    int      `json:"failure_threshold"`
	Regions             []string `json:"regions"`
	MinFailingRegions   int      `json:"min_failing_regions"`
	Active              bool     `json:"active"`
	Muted               bool     `json:"muted"`
	Status              string   `json:"status"`
	ConsecutiveFailures int      `json:"consecutive_failures"`
	LastTransitionSeq   int64    `json:"last_transition_seq"`
}

type Rule struct {
	ID          string          `json:"id"`
	OrgID       string          `json:"org_id"`
	Name        string          `json:"name"`
	Signal      string          `json:"signal"`
	Query       json.RawMessage `json:"query"`
	QueryString string          `json:"query_string"`
	Thresholds  json.RawMessage `json:"thresholds"`
	Notify      json.RawMessage `json:"notify"`
	State       string          `json:"state"`
}

type Channel struct {
	ID     string `json:"id"`
	OrgID  string `json:"org_id"`
	Kind   string `json:"kind"`
	Name   string `json:"name"`
	Target string `json:"target"`
	Secret string `json:"secret"`
	Health string `json:"health"`
}

type RegistryEvent struct {
	OrgID            string   `json:"org_id"`
	Name             string   `json:"name"`
	Dims             []string `json:"dims"`
	UniqueIneligible bool     `json:"unique_ineligible"`
}

type SLO struct {
	ID        string  `json:"id"`
	OrgID     string  `json:"org_id"`
	Name      string  `json:"name"`
	SLISource string  `json:"sli_source"`
	Target    float64 `json:"target"`
	Window    string  `json:"window"`
	MonitorID string  `json:"monitor_id,omitempty"`
	Query     string  `json:"query"`
	State     string  `json:"state"`
}

// Write stores a kind's snapshot and returns its version.
func Write(ctx context.Context, s store.Store, kind string, items any, now time.Time) (int64, error) {
	raw, err := json.Marshal(items)
	if err != nil {
		return 0, err
	}
	if string(raw) == "null" {
		raw = []byte("[]")
	}
	doc := Document{Kind: kind, Version: now.UnixMilli(), Items: raw}
	body, err := json.Marshal(doc)
	if err != nil {
		return 0, err
	}
	return doc.Version, s.Put(ctx, store.ConfigKey(s, kind), body, "application/json")
}

// Read loads a kind's snapshot; a missing one reads as empty, version 0.
func Read[T any](ctx context.Context, s store.Store, kind string) ([]T, int64, error) {
	body, err := s.Get(ctx, store.ConfigKey(s, kind))
	if errors.Is(err, store.ErrMissing) {
		return nil, 0, nil
	}
	if err != nil {
		return nil, 0, err
	}
	var doc Document
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, 0, err
	}
	var items []T
	if err := json.Unmarshal(doc.Items, &items); err != nil {
		return nil, 0, err
	}
	return items, doc.Version, nil
}

// Access is the read side api/query keeps in memory: who may read which
// org (members), and each org's timezone (orgs).
type Access struct {
	store store.Store

	mu       sync.RWMutex
	users    map[string]UserAccess
	orgs     map[string]Org
	monitors map[string]map[string]string // org -> name or id -> id
	versions map[string]int64

	refreshed time.Time
}

func NewAccess(s store.Store) *Access {
	return &Access{store: s, users: map[string]UserAccess{}, orgs: map[string]Org{}, monitors: map[string]map[string]string{},
		versions: map[string]int64{}}
}

// Load reads the members, orgs and monitors snapshots.
func (a *Access) Load(ctx context.Context) error {
	return errors.Join(a.Reload(ctx, KindMembers), a.Reload(ctx, KindOrgs), a.Reload(ctx, KindMonitors))
}

// Reload rereads one kind; other kinds are ignored.
func (a *Access) Reload(ctx context.Context, kind string) error {
	switch kind {
	case KindMembers:
		items, version, err := Read[UserAccess](ctx, a.store, kind)
		if err != nil {
			return err
		}
		users := make(map[string]UserAccess, len(items))
		for _, u := range items {
			users[u.UserID] = u
		}
		a.mu.Lock()
		if version >= a.versions[kind] {
			a.users, a.versions[kind] = users, version
		}
		a.mu.Unlock()
	case KindOrgs:
		items, version, err := Read[Org](ctx, a.store, kind)
		if err != nil {
			return err
		}
		orgs := make(map[string]Org, len(items))
		for _, o := range items {
			orgs[o.ID] = o
		}
		a.mu.Lock()
		if version >= a.versions[kind] {
			a.orgs, a.versions[kind] = orgs, version
		}
		a.mu.Unlock()
	case KindMonitors:
		items, version, err := Read[Monitor](ctx, a.store, kind)
		if err != nil {
			return err
		}
		monitors := map[string]map[string]string{}
		for _, m := range items {
			if monitors[m.OrgID] == nil {
				monitors[m.OrgID] = map[string]string{}
			}
			monitors[m.OrgID][m.ID] = m.ID
			monitors[m.OrgID][m.Name] = m.ID
		}
		a.mu.Lock()
		if version >= a.versions[kind] {
			a.monitors, a.versions[kind] = monitors, version
		}
		a.mu.Unlock()
	default:
		return nil
	}
	slog.Info("config reloaded", "kind", kind)
	return nil
}

// Refresh rereads every kind unless the last refresh was under floor ago,
// and reports whether it did. A service on request-based CPU (S-14) may
// not have consumed upstat.config.changed yet, so a lookup that misses
// (a just-created org, say) calls this once before it answers no.
func (a *Access) Refresh(ctx context.Context, floor time.Duration) bool {
	a.mu.Lock()
	if time.Since(a.refreshed) < floor {
		a.mu.Unlock()
		return false
	}
	a.refreshed = time.Now()
	a.mu.Unlock()
	if err := a.Load(ctx); err != nil {
		slog.Warn("config refresh failed", "error", err)
		return false
	}
	return true
}

// ActiveOrg is the org a user works in and their role there; ok is false
// when the user has no active membership.
func (a *Access) ActiveOrg(userID string) (orgID, role string, ok bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	u, found := a.users[userID]
	if !found {
		return "", "", false
	}
	for _, m := range u.Memberships {
		if m.OrgID == u.ActiveOrgID {
			return m.OrgID, m.Role, true
		}
	}
	return "", "", false
}

// Org returns an org by id.
func (a *Access) Org(id string) (Org, bool) {
	a.mu.RLock()
	defer a.mu.RUnlock()
	o, ok := a.orgs[id]
	return o, ok
}

// Monitors maps an org's monitor names and ids to ids (check: terms).
func (a *Access) Monitors(orgID string) map[string]string {
	a.mu.RLock()
	defer a.mu.RUnlock()
	return a.monitors[orgID]
}
