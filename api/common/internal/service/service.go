// Package service is api/common's business layer: validation from the flow
// specs, authorization from the role matrix (engineering.md §2), and every
// write together with its outbox rows in one transaction. It decides
// nothing about checks or alerts: those decisions arrive from Python as
// events and are persisted here (D2).
package service

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/config"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

// Error is a failure the API reports as the error envelope.
type Error struct {
	Status  int
	Code    string
	Message string
	Details map[string]any
}

func (e *Error) Error() string { return e.Code + ": " + e.Message }

func invalid(code, message string) *Error {
	return &Error{Status: http.StatusUnprocessableEntity, Code: code, Message: message}
}

func notFound(resource string) *Error {
	return &Error{Status: http.StatusNotFound, Code: "not_found", Message: resource + " not found", Details: map[string]any{"resource": resource}}
}

func conflict(code, message string) *Error {
	return &Error{Status: http.StatusConflict, Code: code, Message: message}
}

var errForbidden = &Error{Status: http.StatusForbidden, Code: "forbidden", Message: "Your role does not allow this"}

var errNoOrg = &Error{Status: http.StatusNotFound, Code: "not_found", Message: "Create or join an organization first",
	Details: map[string]any{"resource": "org"}}

// Caller is the authenticated user and their active org.
type Caller struct {
	UserID string
	Email  string
	Name   string
	OrgID  string
	Role   string
}

var rank = map[string]int{"viewer": 1, "member": 2, "admin": 3, "owner": 4}

// can reports whether the caller's role reaches min (engineering.md §2).
func (c *Caller) can(min string) error {
	if c.OrgID == "" {
		return errNoOrg
	}
	if rank[c.Role] < rank[min] {
		return errForbidden
	}
	return nil
}

// Prober calls the probe functions (system-design.md §6.1).
type Prober interface {
	Check(ctx context.Context, region string, req CheckRequest) (*CheckResponse, error)
	Run(ctx context.Context, region string, req RunRequest) (*RunResponse, error)
}

// Telemetry is api/query, read through its internal surface.
type Telemetry interface {
	History(ctx context.Context, orgID, monitorID string) (map[string]any, error)
	Uptime(ctx context.Context, orgID string, monitorIDs []string, days int) (map[string]UptimeSummary, error)
	HasData(ctx context.Context, orgID string) (bool, error)
	Presence(ctx context.Context, orgID string, services []string) (map[string]Presence, error)
	Replay(ctx context.Context, orgID string, req ReplayRequest) (map[string]any, error)
}

// Results sends check results to the telemetry plane (OTLP logs to the
// collector, X-11).
type Results interface {
	Send(ctx context.Context, results []CheckResult) error
}

type Services struct {
	DB        *repository.DB
	Store     store.Store
	Config    *config.Config
	Prober    Prober
	Telemetry Telemetry
	Results   Results
	Now       func() time.Time

	statusCache *statusCache
}

func New(db *repository.DB, s store.Store, cfg *config.Config, prober Prober, telemetry Telemetry, results Results) *Services {
	return &Services{DB: db, Store: s, Config: cfg, Prober: prober, Telemetry: telemetry, Results: results, Now: time.Now,
		statusCache: newStatusCache()}
}

// inOrg runs fn in the caller's org after checking their role.
func (s *Services) inOrg(ctx context.Context, c *Caller, min string, fn func(pgx.Tx) error) error {
	if err := c.can(min); err != nil {
		return err
	}
	return s.DB.AsOrg(ctx, c.OrgID, fn)
}

// orNotFound turns repository.ErrNotFound into the resource's 404.
func orNotFound(err error, resource string) error {
	if errors.Is(err, repository.ErrNotFound) {
		return notFound(resource)
	}
	return err
}
