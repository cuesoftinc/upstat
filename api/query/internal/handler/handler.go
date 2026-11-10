// Package handler is api/query's HTTP surface: the explorers' and
// dashboards' reads for signed-in users (the web proxies /v1/query,
// /v1/logs*, /v1/traces*, /v1/services, /v1/metrics*, /v1/rum*, /v1/usage
// and /v1/stats here), and /internal/v1/* for api/common and analytics.
package handler

import (
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"google.golang.org/api/idtoken"

	"github.com/cuesoftinc/upstat/api/common/pkg/httpx"
	"github.com/cuesoftinc/upstat/api/common/pkg/session"
	"github.com/cuesoftinc/upstat/api/common/pkg/snapshot"
	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
	"github.com/cuesoftinc/upstat/api/query/internal/telemetry"
)

// Internal guards /internal/v1: on Cloud Run a Google ID token for
// Audience from one of Invokers (the common and analytics service
// accounts); elsewhere the shared INTERNAL_TOKEN. Neither set fails closed.
type Internal struct {
	Audience string
	Invokers []string
	Token    string
}

func (in Internal) guard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if in.Token != "" {
			got := r.Header.Get("X-Internal-Token")
			if subtle.ConstantTimeCompare([]byte(got), []byte(in.Token)) == 1 {
				next.ServeHTTP(w, r)
				return
			}
		}
		if in.Audience != "" && len(in.Invokers) > 0 {
			scheme, token, _ := strings.Cut(r.Header.Get("Authorization"), " ")
			if strings.EqualFold(scheme, "Bearer") && token != "" {
				if p, err := idtoken.Validate(r.Context(), token, in.Audience); err == nil {
					email, _ := p.Claims["email"].(string)
					for _, inv := range in.Invokers {
						if email == inv {
							next.ServeHTTP(w, r)
							return
						}
					}
				}
			}
		}
		if in.Token == "" && in.Audience == "" {
			httpx.WriteError(w, http.StatusServiceUnavailable, "unavailable", "Internal auth is not configured", nil)
			return
		}
		httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Internal callers only", nil)
	})
}

type API struct {
	T        *telemetry.Service
	Access   *snapshot.Access
	Internal Internal
	// AccessMaxAge bounds how old the access snapshot is when a request is
	// served; zero means DefaultAccessMaxAge.
	AccessMaxAge time.Duration

	gate  *gate
	cache *cache
}

// refreshFloor bounds the snapshot rereads a miss can cause per instance.
const refreshFloor = 10 * time.Second

// DefaultAccessMaxAge is how stale the in-memory members snapshot may be
// when a request is served, whether or not the config event arrived.
const DefaultAccessMaxAge = 30 * time.Second

func New(t *telemetry.Service, access *snapshot.Access, internal Internal) *API {
	return &API{T: t, Access: access, Internal: internal, gate: &gate{n: map[string]int{}}, cache: &cache{entries: map[string]cached{}}}
}

// gate caps each org at 4 concurrent queries per instance (§6.5).
type gate struct {
	mu sync.Mutex
	n  map[string]int
}

const perOrg = 4

func (g *gate) enter(org string) bool {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.n[org] >= perOrg {
		return false
	}
	g.n[org]++
	return true
}

func (g *gate) leave(org string) {
	g.mu.Lock()
	defer g.mu.Unlock()
	g.n[org]--
}

// cache keeps settled results (ranges that ended over a minute ago) for a
// minute, in process: no Valkey on the read path (S-11).
type cache struct {
	mu      sync.Mutex
	entries map[string]cached
}

type cached struct {
	at   time.Time
	body []byte
}

const cacheTTL = time.Minute

func (c *cache) get(k string) ([]byte, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	e, ok := c.entries[k]
	if !ok || time.Since(e.at) > cacheTTL {
		return nil, false
	}
	return e.body, true
}

func (c *cache) put(k string, body []byte) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.entries) > 2000 {
		clear(c.entries)
	}
	c.entries[k] = cached{at: time.Now(), body: body}
}

type orgKey struct{}

// user resolves the session into the caller's active org and gates it.
func (a *API) user(fn func(w http.ResponseWriter, r *http.Request, orgID string)) http.Handler {
	return session.SessionMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, _ := session.UserIDFromContext(r.Context())
		maxAge := a.AccessMaxAge
		if maxAge <= 0 {
			maxAge = DefaultAccessMaxAge
		}
		a.Access.Refresh(r.Context(), maxAge)
		orgID, _, ok := a.Access.ActiveOrg(userID)
		if !ok && a.Access.Refresh(r.Context(), refreshFloor) {
			orgID, _, ok = a.Access.ActiveOrg(userID)
		}
		if !ok {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Create or join an organization first", map[string]any{"resource": "org"})
			return
		}
		a.run(w, r, orgID, fn)
	}))
}

func (a *API) internal(fn func(w http.ResponseWriter, r *http.Request, orgID string)) http.Handler {
	return a.Internal.guard(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		orgID := r.URL.Query().Get("org_id")
		if orgID == "" {
			httpx.WriteError(w, http.StatusUnprocessableEntity, "bad_shape", "org_id is required", nil)
			return
		}
		a.run(w, r, orgID, fn)
	}))
}

func (a *API) run(w http.ResponseWriter, r *http.Request, orgID string, fn func(http.ResponseWriter, *http.Request, string)) {
	if !a.gate.enter(orgID) {
		w.Header().Set("Retry-After", "1")
		httpx.WriteError(w, http.StatusTooManyRequests, "rate_limited", "Too many queries in flight for this organization", nil)
		return
	}
	defer a.gate.leave(orgID)
	fn(w, r.WithContext(context.WithValue(r.Context(), orgKey{}, orgID)), orgID)
}

func (a *API) respond(w http.ResponseWriter, r *http.Request, v any, err error) {
	var te *telemetry.Error
	var ce *chdb.Error
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, v)
	case errors.As(err, &te):
		httpx.WriteError(w, http.StatusUnprocessableEntity, te.Code, te.Message, te.Details)
	case errors.As(err, &ce) && ce.Timeout():
		httpx.WriteError(w, http.StatusUnprocessableEntity, "query_too_expensive", "The query exceeded its time or memory budget; narrow it", nil)
	case errors.Is(err, context.DeadlineExceeded):
		httpx.WriteError(w, http.StatusGatewayTimeout, "timeout", "The query took too long", nil)
	default:
		slog.ErrorContext(r.Context(), "query failed", "route", r.Pattern, "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "Something went wrong", nil)
	}
}

func (a *API) Register(mux *http.ServeMux) {
	t := a.T
	q := func(r *http.Request, k string) string { return r.URL.Query().Get(k) }

	query := func(w http.ResponseWriter, r *http.Request, orgID string) {
		var req telemetry.QueryRequest
		if err := httpx.ReadJSON(r, &req); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "bad_shape", "malformed JSON body", nil)
			return
		}
		key := ""
		if to, err := time.Parse(time.RFC3339Nano, req.To); err == nil && time.Since(to) > time.Minute {
			raw, _ := json.Marshal(req)
			sum := sha256.Sum256(append([]byte(orgID+"|"), raw...))
			key = hex.EncodeToString(sum[:])
			if body, ok := a.cache.get(key); ok {
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write(body)
				return
			}
		}
		out, err := t.Query(r.Context(), orgID, req)
		if err == nil && key != "" {
			if body, merr := json.Marshal(out); merr == nil {
				a.cache.put(key, append(body, '\n'))
			}
		}
		a.respond(w, r, out, err)
	}
	mux.Handle("POST /v1/query", a.user(query))
	mux.Handle("GET /v1/logs", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		limit, _ := strconv.Atoi(q(r, "limit"))
		out, err := t.Logs(r.Context(), orgID, telemetry.LogParams{Q: q(r, "q"), From: q(r, "from"), To: q(r, "to"), Cursor: q(r, "cursor"),
			Limit: limit, Live: q(r, "live") == "1"})
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/logs/patterns", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Patterns(r.Context(), orgID, q(r, "q"), q(r, "from"), q(r, "to"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/traces", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		limit, _ := strconv.Atoi(q(r, "limit"))
		out, err := t.Traces(r.Context(), orgID, q(r, "q"), q(r, "from"), q(r, "to"), limit)
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/traces/{id}", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Trace(r.Context(), orgID, r.PathValue("id"))
		if err == nil && out == nil {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "trace not found", map[string]any{"resource": "trace"})
			return
		}
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/services", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Services(r.Context(), orgID)
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/metrics/summary", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.MetricsSummary(r.Context(), orgID)
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/rum/summary", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.RumSummary(r.Context(), orgID, q(r, "property"), q(r, "from"), q(r, "to"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/rum/vitals", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Vitals(r.Context(), orgID, q(r, "property"), q(r, "from"), q(r, "to"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/rum/errors", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Errors(r.Context(), orgID)
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/rum/drilldown", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Drilldown(r.Context(), orgID, q(r, "property"), q(r, "event"), q(r, "from"), q(r, "to"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/stats", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.Stats(r.Context(), orgID, q(r, "property"), q(r, "name"), q(r, "period"), q(r, "from"), q(r, "to"), q(r, "dim"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /v1/usage", a.user(func(w http.ResponseWriter, r *http.Request, orgID string) {
		loc := time.UTC
		if org, ok := a.Access.Org(orgID); ok {
			if l, err := time.LoadLocation(org.Timezone); err == nil {
				loc = l
			}
		}
		out, err := t.Usage(r.Context(), orgID, loc)
		a.respond(w, r, out, err)
	}))

	// Internal reads (api/common, analytics).
	mux.Handle("POST /internal/v1/query", a.internal(query))
	mux.Handle("GET /internal/v1/monitors/{id}/history", a.internal(func(w http.ResponseWriter, r *http.Request, orgID string) {
		out, err := t.History(r.Context(), orgID, r.PathValue("id"))
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /internal/v1/uptime", a.internal(func(w http.ResponseWriter, r *http.Request, orgID string) {
		days, _ := strconv.Atoi(q(r, "days"))
		var ids []string
		for _, id := range strings.Split(q(r, "monitor_ids"), ",") {
			if id = strings.TrimSpace(id); id != "" {
				ids = append(ids, id)
			}
		}
		out, err := t.Uptime(r.Context(), orgID, ids, days)
		a.respond(w, r, out, err)
	}))
	mux.Handle("GET /internal/v1/has-data", a.internal(func(w http.ResponseWriter, r *http.Request, orgID string) {
		has, err := t.HasData(r.Context(), orgID)
		a.respond(w, r, map[string]bool{"has_data": has}, err)
	}))
	mux.Handle("GET /internal/v1/presence", a.internal(func(w http.ResponseWriter, r *http.Request, orgID string) {
		var services []string
		for _, s := range strings.Split(q(r, "services"), ",") {
			if s = strings.TrimSpace(s); s != "" {
				services = append(services, s)
			}
		}
		out, err := t.Presence(r.Context(), orgID, services)
		a.respond(w, r, out, err)
	}))
	mux.Handle("POST /internal/v1/replay", a.internal(func(w http.ResponseWriter, r *http.Request, orgID string) {
		var req telemetry.ReplayRequest
		if err := httpx.ReadJSON(r, &req); err != nil {
			httpx.WriteError(w, http.StatusBadRequest, "bad_shape", "malformed JSON body", nil)
			return
		}
		out, err := t.Replay(r.Context(), orgID, req)
		a.respond(w, r, out, err)
	}))

	httpx.RegisterNotFound(mux)
}
