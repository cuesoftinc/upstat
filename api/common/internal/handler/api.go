package handler

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/service"
	"github.com/cuesoftinc/upstat/api/common/pkg/httpx"
	"github.com/cuesoftinc/upstat/api/common/pkg/session"
)

// Limiter is the per-user API rate limit (engineering.md §3); nil or an
// unreachable store lets requests through (fail open).
type Limiter interface {
	Allow(ctx context.Context, key string, limit int, window time.Duration) (ok bool, retryAfter time.Duration)
}

// API serves the control-plane surface the web's mock defines (§7.3).
type API struct {
	S       *service.Services
	Limiter Limiter
}

type callerKey struct{}

func callerOf(r *http.Request) *service.Caller {
	c, _ := r.Context().Value(callerKey{}).(*service.Caller)
	return c
}

var uuidRe = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// idParams are the path values that name a row by uuid.
var idParams = []string{"id", "runId", "widgetId"}

// malformedID reports a uuid path value that is not one: it names nothing.
func malformedID(r *http.Request) bool {
	for _, name := range idParams {
		if v := r.PathValue(name); v != "" && !uuidRe.MatchString(v) {
			return true
		}
	}
	return false
}

// authed resolves the session into a caller and applies the rate limit:
// limit requests per minute per user for this route group.
func (a *API) authed(limit int, next func(http.ResponseWriter, *http.Request, *service.Caller)) http.Handler {
	return session.SessionMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if malformedID(r) {
			httpx.WriteError(w, http.StatusNotFound, "not_found", "Not found", nil)
			return
		}
		userID, _ := session.UserIDFromContext(r.Context())
		c, err := a.S.CallerFor(r.Context(), userID)
		if errors.Is(err, repository.ErrNotFound) {
			httpx.WriteError(w, http.StatusUnauthorized, "unauthorized", "Authentication required", nil)
			return
		}
		if err != nil {
			a.fail(w, r, err)
			return
		}
		if a.Limiter != nil && limit > 0 {
			if ok, retry := a.Limiter.Allow(r.Context(), "api:"+r.Pattern+":"+userID, limit, time.Minute); !ok {
				w.Header().Set("Retry-After", strconv.Itoa(int(retry.Seconds())+1))
				httpx.WriteError(w, http.StatusTooManyRequests, "rate_limited", "Too many requests; slow down", nil)
				return
			}
		}
		next(w, r.WithContext(context.WithValue(r.Context(), callerKey{}, c)), c)
	}))
}

// fail writes err as the error envelope.
func (a *API) fail(w http.ResponseWriter, r *http.Request, err error) {
	var se *service.Error
	switch {
	case errors.As(err, &se):
		httpx.WriteError(w, se.Status, se.Code, se.Message, se.Details)
	case errors.Is(err, repository.ErrNotFound), repository.IsMalformed(err):
		httpx.WriteError(w, http.StatusNotFound, "not_found", "Not found", nil)
	case errors.Is(err, repository.ErrConflict):
		httpx.WriteError(w, http.StatusConflict, "conflict", "That conflicts with an existing resource", nil)
	case errors.Is(err, context.DeadlineExceeded):
		httpx.WriteError(w, http.StatusGatewayTimeout, "timeout", "The request took too long", nil)
	default:
		slog.ErrorContext(r.Context(), "request failed", "route", r.Pattern, "error", err)
		httpx.WriteError(w, http.StatusInternalServerError, "internal", "Something went wrong", nil)
	}
}

func (a *API) respond(w http.ResponseWriter, r *http.Request, status int, v any, err error) {
	if err != nil {
		a.fail(w, r, err)
		return
	}
	httpx.WriteJSON(w, status, v)
}

func (a *API) done(w http.ResponseWriter, r *http.Request, err error) {
	if err != nil {
		a.fail(w, r, err)
		return
	}
	httpx.NoContent(w)
}

// body decodes the JSON body or answers 400 bad_shape.
func body[T any](w http.ResponseWriter, r *http.Request) (*T, bool) {
	var v T
	if err := httpx.ReadJSON(r, &v); err != nil {
		httpx.WriteError(w, http.StatusBadRequest, "bad_shape", "malformed JSON body", nil)
		return nil, false
	}
	return &v, true
}

// Route groups' per-user limits per minute (engineering.md §3).
const (
	readLimit   = 600
	writeLimit  = 60
	replayLimit = 6
)

// Register mounts every route on mux.
func (a *API) Register(mux *http.ServeMux) {
	s := a.S
	get := func(pattern string, fn func(http.ResponseWriter, *http.Request, *service.Caller)) {
		mux.Handle("GET "+pattern, a.authed(readLimit, fn))
	}
	write := func(method, pattern string, fn func(http.ResponseWriter, *http.Request, *service.Caller)) {
		mux.Handle(method+" "+pattern, a.authed(writeLimit, fn))
	}
	id := func(r *http.Request) string { return r.PathValue("id") }

	// Orgs and onboarding
	get("/v1/orgs", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListOrgs(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	get("/v1/orgs/current", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.CurrentOrg(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/orgs", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct{ Name, Timezone string }](w, r)
		if ok {
			out, err := s.CreateOrg(r.Context(), c, in.Name, in.Timezone)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/orgs/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct{ Name, Timezone *string }](w, r)
		if ok {
			out, err := s.UpdateOrg(r.Context(), c, id(r), in.Name, in.Timezone)
			a.respond(w, r, 200, out, err)
		}
	})
	write("POST", "/v1/orgs/{id}/activate", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ActivateOrg(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	get("/v1/onboarding", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.Onboarding(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})

	// Members
	get("/v1/members", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListMembers(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/members", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct{ Email, Role string }](w, r)
		if ok {
			out, err := s.InviteMember(r.Context(), c, in.Email, in.Role)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/members/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct{ Role, Status *string }](w, r)
		if ok {
			out, err := s.UpdateMember(r.Context(), c, id(r), in.Role, in.Status)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/members/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.RemoveMember(r.Context(), c, id(r)))
	})

	// Ingest keys and the event registry
	get("/v1/keys", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListKeys(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/keys", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.KeyInput](w, r)
		if ok {
			out, err := s.CreateKey(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/keys/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct {
			AllowedOrigins []string `json:"allowed_origins"`
		}](w, r)
		if ok {
			out, err := s.SetKeyOrigins(r.Context(), c, id(r), in.AllowedOrigins)
			a.respond(w, r, 200, out, err)
		}
	})
	write("POST", "/v1/keys/{id}/rotate", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.RotateKey(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("DELETE", "/v1/keys/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.RevokeKey(r.Context(), c, id(r)))
	})
	get("/v1/registry", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListRegistry(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/registry", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[model.RegistryEvent](w, r)
		if ok {
			out, err := s.RegisterEvent(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("DELETE", "/v1/registry/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.UnregisterEvent(r.Context(), c, id(r)))
	})

	// Monitors
	get("/v1/monitors", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListMonitors(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/monitors", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.MonitorInput](w, r)
		if ok {
			out, err := s.CreateMonitor(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetMonitor(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("PATCH", "/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.MonitorInput](w, r)
		if ok {
			out, err := s.UpdateMonitor(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/monitors/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteMonitor(r.Context(), c, id(r)))
	})
	get("/v1/monitors/{id}/checks", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.MonitorHistory(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	get("/v1/monitors/{id}/insights", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.MonitorInsights(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	mux.Handle("POST /v1/monitors/{id}/test", a.authed(replayLimit, func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.TestMonitor(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	}))

	// Synthetics
	get("/v1/synthetics", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListSynthetics(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/synthetics", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.SyntheticInput](w, r)
		if ok {
			out, err := s.CreateSynthetic(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/synthetics/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetSynthetic(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("PATCH", "/v1/synthetics/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.SyntheticInput](w, r)
		if ok {
			out, err := s.UpdateSynthetic(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/synthetics/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteSynthetic(r.Context(), c, id(r)))
	})
	get("/v1/synthetics/{id}/runs", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListRuns(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	mux.Handle("POST /v1/synthetics/{id}/runs", a.authed(replayLimit, func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.RunSyntheticNow(r.Context(), c, id(r))
		a.respond(w, r, 201, out, err)
	}))
	get("/v1/synthetics/{id}/runs/{runId}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetRun(r.Context(), c, id(r), r.PathValue("runId"))
		a.respond(w, r, 200, out, err)
	})

	// Alerting
	get("/v1/channels", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListChannels(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/channels", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.ChannelInput](w, r)
		if ok {
			out, err := s.CreateChannel(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/channels/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetChannel(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("DELETE", "/v1/channels/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteChannel(r.Context(), c, id(r)))
	})
	write("POST", "/v1/channels/{id}/verify", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.VerifyChannel(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	get("/v1/rules", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListRules(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/rules", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.RuleInput](w, r)
		if ok {
			out, err := s.CreateRule(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/rules/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.RuleInput](w, r)
		if ok {
			out, err := s.UpdateRule(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/rules/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteRule(r.Context(), c, id(r)))
	})
	mux.Handle("POST /v1/rules/{id}/test", a.authed(replayLimit, func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.TestRule(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	}))
	get("/v1/alerts/feed", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.AlertFeed(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/alerts/feed/read", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.MarkFeedRead(r.Context(), c))
	})

	// Incidents
	get("/v1/incidents", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListIncidents(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/incidents", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.IncidentInput](w, r)
		if ok {
			out, err := s.DeclareIncident(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/incidents/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetIncident(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("PATCH", "/v1/incidents/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.IncidentInput](w, r)
		if ok {
			out, err := s.UpdateIncident(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	get("/v1/incidents/{id}/timeline", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.Timeline(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/incidents/{id}/timeline", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.TimelineInput](w, r)
		if ok {
			out, err := s.AddTimeline(r.Context(), c, id(r), *in)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/incidents/{id}/postmortem", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetPostmortem(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("PUT", "/v1/incidents/{id}/postmortem", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.PostmortemInput](w, r)
		if ok {
			out, created, err := s.SavePostmortem(r.Context(), c, id(r), *in)
			status := 200
			if created {
				status = 201
			}
			a.respond(w, r, status, out, err)
		}
	})

	// SLOs
	get("/v1/slos", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListSLOs(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/slos", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.SLOInput](w, r)
		if ok {
			out, err := s.CreateSLO(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("DELETE", "/v1/slos/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteSLO(r.Context(), c, id(r)))
	})

	// Dashboards
	get("/v1/dashboards", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListDashboards(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/dashboards", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[struct{ Name string }](w, r)
		if ok {
			out, err := s.CreateDashboard(r.Context(), c, in.Name)
			a.respond(w, r, 201, out, err)
		}
	})
	get("/v1/dashboards/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.GetDashboard(r.Context(), c, id(r))
		a.respond(w, r, 200, out, err)
	})
	write("PATCH", "/v1/dashboards/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.DashboardInput](w, r)
		if ok {
			out, err := s.UpdateDashboard(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/dashboards/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteDashboard(r.Context(), c, id(r)))
	})
	write("POST", "/v1/dashboards/{id}/widgets", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.WidgetInput](w, r)
		if ok {
			out, err := s.AddWidget(r.Context(), c, id(r), *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/dashboards/{id}/widgets/{widgetId}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.WidgetInput](w, r)
		if ok {
			out, err := s.UpdateWidget(r.Context(), c, id(r), r.PathValue("widgetId"), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/dashboards/{id}/widgets/{widgetId}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteWidget(r.Context(), c, id(r), r.PathValue("widgetId")))
	})

	// Saved views
	get("/v1/views", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListViews(r.Context(), c, r.URL.Query().Get("surface"))
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/views", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[model.SavedView](w, r)
		if ok {
			out, err := s.CreateView(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("DELETE", "/v1/views/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteView(r.Context(), c, id(r)))
	})

	// Service catalog
	get("/v1/catalog", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.ListCatalog(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("POST", "/v1/catalog", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[model.CatalogEntry](w, r)
		if ok {
			out, err := s.CreateCatalog(r.Context(), c, *in)
			a.respond(w, r, 201, out, err)
		}
	})
	write("PATCH", "/v1/catalog/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[service.CatalogInput](w, r)
		if ok {
			out, err := s.UpdateCatalog(r.Context(), c, id(r), *in)
			a.respond(w, r, 200, out, err)
		}
	})
	write("DELETE", "/v1/catalog/{id}", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		a.done(w, r, s.DeleteCatalog(r.Context(), c, id(r)))
	})

	// Status page: the builder (authed) and the public page.
	get("/v1/status-page", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		out, err := s.StatusPageConfig(r.Context(), c)
		a.respond(w, r, 200, out, err)
	})
	write("PUT", "/v1/status-page", func(w http.ResponseWriter, r *http.Request, c *service.Caller) {
		in, ok := body[model.StatusPageConfig](w, r)
		if ok {
			out, err := s.SaveStatusPage(r.Context(), c, *in)
			a.respond(w, r, 200, out, err)
		}
	})
	mux.HandleFunc("GET /v1/status/{slug}", func(w http.ResponseWriter, r *http.Request) {
		out, err := s.PublicStatusPage(r.Context(), r.PathValue("slug"))
		if err == nil {
			// The CDN absorbs incident-time spikes (§6.7).
			w.Header().Set("Cache-Control", "public, max-age=30, stale-while-revalidate=300")
		}
		a.respond(w, r, 200, out, err)
	})

	httpx.RegisterNotFound(mux)
}
