package handler

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/internal/util"
	"go.mongodb.org/mongo-driver/mongo"
)

const (
	defaultRecentChecks = 50
	maxRecentChecks     = 500
	resolvedIncidents   = 50
	maxMonitorBody      = 64 << 10
)

type MonitorHandler struct {
	monitors  repository.MonitorRepository
	checks    repository.CheckResultRepository
	incidents repository.IncidentRepository
	allowed   func(origin string) bool
}

func NewMonitorHandler(monitors repository.MonitorRepository, checks repository.CheckResultRepository, incidents repository.IncidentRepository, allowed func(origin string) bool) *MonitorHandler {
	return &MonitorHandler{monitors: monitors, checks: checks, incidents: incidents, allowed: allowed}
}

// Register mounts the monitor routes; recent checks and the status page stay public as they were over gRPC.
func (h *MonitorHandler) Register(mux *http.ServeMux) {
	authed := func(fn http.HandlerFunc) http.Handler {
		return h.cors(util.SessionMiddleware(fn))
	}
	mux.Handle("GET /v1/monitors", authed(h.List))
	mux.Handle("POST /v1/monitors", authed(h.Create))
	mux.Handle("GET /v1/monitors/{id}", authed(h.Get))
	mux.Handle("PATCH /v1/monitors/{id}", authed(h.Update))
	mux.Handle("DELETE /v1/monitors/{id}", authed(h.Delete))
	mux.Handle("GET /v1/monitors/{id}/checks", h.cors(http.HandlerFunc(h.Checks)))
	mux.Handle("GET /v1/status/{ownerId}", h.cors(http.HandlerFunc(h.StatusPage)))
	preflight := h.cors(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))
	mux.Handle("OPTIONS /v1/monitors", preflight)
	mux.Handle("OPTIONS /v1/monitors/", preflight)
	mux.Handle("OPTIONS /v1/status/", preflight)
}

type monitorInput struct {
	Name   *string `json:"name"`
	Target *string `json:"target"`
	Type   *string `json:"type"`
}

type monitorResponse struct {
	ID                  string     `json:"id"`
	OwnerID             string     `json:"owner_id"`
	Name                string     `json:"name"`
	Target              string     `json:"target"`
	Type                string     `json:"type"`
	Active              bool       `json:"active"`
	Status              string     `json:"status"`
	Muted               bool       `json:"muted"`
	IntervalSeconds     int        `json:"interval_seconds"`
	TimeoutSeconds      int        `json:"timeout_seconds"`
	FailureThreshold    int        `json:"failure_threshold"`
	ConsecutiveFailures int        `json:"consecutive_failures"`
	LastCheckedAt       *time.Time `json:"last_checked_at"`
	LastResponseTimeMs  *int64     `json:"last_response_time_ms"`
	LastStatusCode      *int       `json:"last_status_code"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

type checkResponse struct {
	ID             string    `json:"id"`
	MonitorID      string    `json:"monitor_id"`
	Up             bool      `json:"up"`
	StatusCode     int       `json:"status_code"`
	ResponseTimeMs int64     `json:"response_time_ms"`
	CheckedAt      time.Time `json:"checked_at"`
}

type historyResponse struct {
	MonitorID    string          `json:"monitor_id"`
	Days         []any           `json:"days"`
	RecentChecks []checkResponse `json:"recent_checks"`
	Uptime90dPct *float64        `json:"uptime_90d_pct"`
}

type incidentResponse struct {
	ID              string     `json:"id"`
	MonitorID       string     `json:"monitor_id"`
	Title           string     `json:"title"`
	FailureReason   string     `json:"failure_reason"`
	Status          string     `json:"status"`
	StartedAt       time.Time  `json:"started_at"`
	ResolvedAt      *time.Time `json:"resolved_at"`
	DurationSeconds int64      `json:"duration_seconds"`
}

type statusPageResponse struct {
	Monitors            []monitorResponse  `json:"monitors"`
	ActiveIncidents     []incidentResponse `json:"active_incidents"`
	HistoricalIncidents []incidentResponse `json:"historical_incidents"`
	UptimePercentage    float64            `json:"uptime_percentage"`
	TotalChecks         int64              `json:"total_checks"`
	SuccessfulChecks    int64              `json:"successful_checks"`
}

func (h *MonitorHandler) List(w http.ResponseWriter, r *http.Request) {
	owner, _ := util.UserIDFromContext(r.Context())
	monitors, err := h.monitors.ListMonitors(owner)
	if err != nil {
		h.internal(w, "list monitors", err)
		return
	}
	writeJSON(w, http.StatusOK, toMonitors(monitors))
}

func (h *MonitorHandler) Create(w http.ResponseWriter, r *http.Request) {
	owner, _ := util.UserIDFromContext(r.Context())
	in, ok := readMonitorInput(w, r)
	if !ok {
		return
	}
	if value(in.Name) == "" || value(in.Type) == "" || value(in.Target) == "" {
		writeError(w, http.StatusUnprocessableEntity, "bad_shape", "name, type and target are required")
		return
	}
	created, err := h.monitors.CreateMonitor(model.Monitor{
		OwnerId:          owner,
		Name:             *in.Name,
		Type:             *in.Type,
		Target:           *in.Target,
		Active:           true,
		Status:           "unknown",
		IntervalSeconds:  60,
		TimeoutSeconds:   10,
		FailureThreshold: 3,
	})
	if err != nil {
		h.internal(w, "create monitor", err)
		return
	}
	writeJSON(w, http.StatusCreated, toMonitor(created))
}

func (h *MonitorHandler) Get(w http.ResponseWriter, r *http.Request) {
	owner, _ := util.UserIDFromContext(r.Context())
	monitor, err := h.monitors.GetMonitor(r.PathValue("id"), owner)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "monitor not found")
		return
	}
	writeJSON(w, http.StatusOK, toMonitor(monitor))
}

func (h *MonitorHandler) Update(w http.ResponseWriter, r *http.Request) {
	owner, _ := util.UserIDFromContext(r.Context())
	id := r.PathValue("id")
	in, ok := readMonitorInput(w, r)
	if !ok {
		return
	}
	current, err := h.monitors.GetMonitor(id, owner)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "monitor not found")
		return
	}
	next := model.Monitor{OwnerId: owner, Name: current.Name, Type: current.Type, Target: current.Target}
	if in.Name != nil {
		next.Name = *in.Name
	}
	if in.Type != nil {
		next.Type = *in.Type
	}
	if in.Target != nil {
		next.Target = *in.Target
	}
	if next.Name == "" || next.Type == "" || next.Target == "" {
		writeError(w, http.StatusUnprocessableEntity, "bad_shape", "name, type and target cannot be empty")
		return
	}
	updated, err := h.monitors.UpdateMonitor(id, owner, next)
	if err != nil {
		writeError(w, http.StatusNotFound, "not_found", "monitor not found")
		return
	}
	writeJSON(w, http.StatusOK, toMonitor(updated))
}

func (h *MonitorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	owner, _ := util.UserIDFromContext(r.Context())
	result, err := h.monitors.DeleteMonitor(r.PathValue("id"), owner)
	if err != nil || result == nil || result.DeletedCount == 0 {
		writeError(w, http.StatusNotFound, "not_found", "monitor not found")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *MonitorHandler) Checks(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	limit := int64(defaultRecentChecks)
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || n < 1 {
			writeError(w, http.StatusBadRequest, "bad_shape", "limit must be a positive integer")
			return
		}
		limit = min(n, maxRecentChecks)
	}
	checks, err := h.checks.ListRecentByMonitor(id, limit)
	if err != nil {
		h.internal(w, "list recent checks", err)
		return
	}
	since := time.Now().Add(-90 * 24 * time.Hour)
	total, successful, err := h.counts([]string{id}, since)
	if err != nil {
		h.internal(w, "count checks", err)
		return
	}
	out := historyResponse{MonitorID: id, Days: []any{}, RecentChecks: make([]checkResponse, 0, len(checks))}
	if total > 0 {
		pct := float64(successful) / float64(total) * 100
		out.Uptime90dPct = &pct
	}
	for _, c := range checks {
		out.RecentChecks = append(out.RecentChecks, checkResponse{
			ID:             c.Id.Hex(),
			MonitorID:      c.MonitorID,
			Up:             c.Status == "up",
			StatusCode:     c.StatusCode,
			ResponseTimeMs: c.ResponseTimeMs,
			CheckedAt:      c.CheckedAt,
		})
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *MonitorHandler) StatusPage(w http.ResponseWriter, r *http.Request) {
	monitors, err := h.monitors.ListMonitors(r.PathValue("ownerId"))
	if err != nil {
		h.internal(w, "list status page monitors", err)
		return
	}
	ids := make([]string, 0, len(monitors))
	for _, m := range monitors {
		ids = append(ids, m.Id.Hex())
	}
	out := statusPageResponse{Monitors: toMonitors(monitors), ActiveIncidents: []incidentResponse{}, HistoricalIncidents: []incidentResponse{}}
	if len(ids) > 0 {
		active, err := h.incidents.ListActiveIncidentsByMonitors(ids)
		if err != nil {
			h.internal(w, "list active incidents", err)
			return
		}
		resolved, err := h.incidents.ListResolvedIncidentsByMonitors(ids, resolvedIncidents)
		if err != nil {
			h.internal(w, "list resolved incidents", err)
			return
		}
		out.ActiveIncidents = toIncidents(active)
		out.HistoricalIncidents = toIncidents(resolved)
	}
	out.TotalChecks, out.SuccessfulChecks, err = h.counts(ids, time.Now().Add(-24*time.Hour))
	if err != nil {
		h.internal(w, "count checks", err)
		return
	}
	if out.TotalChecks > 0 {
		out.UptimePercentage = float64(out.SuccessfulChecks) / float64(out.TotalChecks) * 100
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *MonitorHandler) counts(ids []string, since time.Time) (int64, int64, error) {
	var total, successful int64
	for _, id := range ids {
		t, err := h.checks.CountTotalSince(id, since)
		if err != nil {
			return 0, 0, err
		}
		s, err := h.checks.CountSuccessfulSince(id, since)
		if err != nil {
			return 0, 0, err
		}
		total += t
		successful += s
	}
	return total, successful, nil
}

func (h *MonitorHandler) cors(next http.Handler) http.Handler {
	return corsFor(h.allowed, "GET, POST, PATCH, DELETE, OPTIONS", next)
}

func (h *MonitorHandler) internal(w http.ResponseWriter, op string, err error) {
	if errors.Is(err, mongo.ErrNoDocuments) {
		writeError(w, http.StatusNotFound, "not_found", "monitor not found")
		return
	}
	slog.Error(op, "error", err)
	writeError(w, http.StatusInternalServerError, "internal", "could not complete the request")
}

func readMonitorInput(w http.ResponseWriter, r *http.Request) (monitorInput, bool) {
	var in monitorInput
	body, err := io.ReadAll(io.LimitReader(r.Body, maxMonitorBody+1))
	if err != nil || len(body) > maxMonitorBody || json.Unmarshal(body, &in) != nil {
		writeError(w, http.StatusBadRequest, "bad_shape", "malformed JSON body")
		return in, false
	}
	return in, true
}

func value(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

func toMonitors(monitors []*model.Monitor) []monitorResponse {
	out := make([]monitorResponse, 0, len(monitors))
	for _, m := range monitors {
		out = append(out, toMonitor(m))
	}
	return out
}

func toMonitor(m *model.Monitor) monitorResponse {
	out := monitorResponse{
		ID:                  m.Id.Hex(),
		OwnerID:             m.OwnerId,
		Name:                m.Name,
		Target:              m.Target,
		Type:                m.Type,
		Active:              m.Active,
		Status:              m.Status,
		IntervalSeconds:     m.IntervalSeconds,
		TimeoutSeconds:      m.TimeoutSeconds,
		FailureThreshold:    m.FailureThreshold,
		ConsecutiveFailures: m.ConsecutiveFailures,
		LastCheckedAt:       m.LastCheckedAt,
		CreatedAt:           m.CreatedAt,
		UpdatedAt:           m.UpdatedAt,
	}
	if m.LastCheckedAt != nil {
		rt, code := m.LastResponseTimeMs, m.LastStatusCode
		out.LastResponseTimeMs = &rt
		out.LastStatusCode = &code
	}
	return out
}

func toIncidents(incidents []*model.Incident) []incidentResponse {
	out := make([]incidentResponse, 0, len(incidents))
	for _, i := range incidents {
		out = append(out, incidentResponse{
			ID:              i.Id.Hex(),
			MonitorID:       i.MonitorID,
			Title:           i.Title,
			FailureReason:   i.FailureReason,
			Status:          i.Status,
			StartedAt:       i.StartedAt,
			ResolvedAt:      i.ResolvedAt,
			DurationSeconds: i.DurationSeconds,
		})
	}
	return out
}
