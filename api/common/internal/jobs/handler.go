package jobs

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
)

const (
	Path         = "/internal/jobs/"
	RunChecksJob = "run-checks"
)

type Runner interface {
	RunOnce(ctx context.Context) error
}

type response struct {
	Job string `json:"job"`
	Ms  int64  `json:"ms"`
}

type errorResponse struct {
	Error string `json:"error"`
}

// Handler serves POST /internal/jobs/run-checks behind the scheduler OIDC guard.
type Handler struct {
	Verifier TokenVerifier
	Checks   Runner
}

func (h Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if !h.authorize(w, r) {
		return
	}

	if strings.TrimPrefix(r.URL.Path, Path) != RunChecksJob {
		writeJSON(w, http.StatusNotFound, errorResponse{Error: "not found"})
		return
	}
	if r.Method != http.MethodPost {
		w.Header().Set("Allow", http.MethodPost)
		writeJSON(w, http.StatusMethodNotAllowed, errorResponse{Error: "method not allowed"})
		return
	}

	start := time.Now()
	if err := h.Checks.RunOnce(r.Context()); err != nil {
		slog.Error("job failed", "job", RunChecksJob, "error", err)
		writeJSON(w, http.StatusInternalServerError, errorResponse{Error: "job failed"})
		return
	}
	writeJSON(w, http.StatusOK, response{Job: RunChecksJob, Ms: time.Since(start).Milliseconds()})
}

// authorize fails closed: unset scheduler config is 503, the token is never logged.
func (h Handler) authorize(w http.ResponseWriter, r *http.Request) bool {
	cfg := config.LoadScheduler()
	if !cfg.Configured() {
		slog.Error("scheduler auth not configured")
		writeJSON(w, http.StatusServiceUnavailable, errorResponse{Error: "scheduler auth is not configured"})
		return false
	}

	fields := strings.Fields(r.Header.Get("Authorization"))
	if len(fields) != 2 || !strings.EqualFold(fields[0], "Bearer") {
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "missing bearer token"})
		return false
	}

	claims, err := h.Verifier.Verify(r.Context(), fields[1], cfg.Audience)
	if err != nil || claims == nil {
		slog.Warn("scheduler token rejected", "error", err)
		writeJSON(w, http.StatusUnauthorized, errorResponse{Error: "invalid token"})
		return false
	}

	if !claims.EmailVerified || claims.Email != cfg.InvokerEmail {
		slog.Warn("scheduler token rejected: caller is not the invoker")
		writeJSON(w, http.StatusForbidden, errorResponse{Error: "caller is not allowed"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(body)
}
