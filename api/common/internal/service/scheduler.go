package service

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
	"github.com/cuesoftinc/upstat/api/common/internal/repository"
	"github.com/cuesoftinc/upstat/api/common/pkg/bus"
	"github.com/cuesoftinc/upstat/api/common/pkg/store"
)

// The scheduler (system-design.md §6.1) is a lookup-then-write plus a
// relay: claim due monitors, call the probe in each region, publish what
// each returned. Deciding up or down is analytics' job.

// CheckRequest is one HTTP check for the probe.
type CheckRequest struct {
	JobID    string `json:"job_id"`
	Target   string `json:"target"`
	TimeoutS int    `json:"timeout_s"`
}

// CheckResponse is the probe's answer (flows/monitor.md §4 causes).
type CheckResponse struct {
	OK           bool       `json:"ok"`
	Cause        string     `json:"cause"`
	StatusCode   int        `json:"status_code"`
	DNSMs        float64    `json:"dns_ms"`
	ConnectMs    float64    `json:"connect_ms"`
	TLSMs        float64    `json:"tls_ms"`
	TTFBMs       float64    `json:"ttfb_ms"`
	TotalMs      float64    `json:"total_ms"`
	CertNotAfter *time.Time `json:"cert_not_after"`
}

// RunRequest is a synthetic check for the probe.
type RunRequest struct {
	Kind    string                `json:"kind"`
	Steps   []model.SyntheticStep `json:"steps"`
	Browser *model.BrowserConfig  `json:"browser"`
}

type RunResponse struct {
	Steps          []model.SyntheticStepResult `json:"steps"`
	ScreenshotStep int                         `json:"screenshot_step"`
}

// CheckResult is one region's answer as the telemetry plane stores it.
type CheckResult struct {
	TickID, MonitorID, OrgID, Region, Cause  string
	ScheduledAt, CheckedAt                   time.Time
	OK, Missing                              bool
	StatusCode, TimeoutS                     int
	DNSMs, ConnectMs, TLSMs, TTFBMs, TotalMs float64
	CertNotAfter                             *time.Time
}

const (
	claimBatch  = 500
	maxInFlight = 200
)

// claimLease is how long a claimed monitor or check stays out of other
// passes when its own pass dies before recording the tick.
const claimLease = 3 * time.Minute

// tickSpace names ticks: a tick id is a function of the monitor and slot,
// so a retried slot reaches analytics under the id it already knows.
var tickSpace = uuid.MustParse("7d0f3a52-9a45-4c1e-8f67-5b2d6e0a1c34")

func tickID(monitorID string, slot time.Time) string {
	return uuid.NewSHA1(tickSpace, []byte(monitorID+"|"+slot.UTC().Format(time.RFC3339Nano))).String()
}

// RunChecks runs one pass of due monitors and due synthetics; Cloud
// Scheduler calls it every minute (POST /internal/jobs/run-checks).
func (s *Services) RunChecks(ctx context.Context) error {
	if len(s.Config.Probes) == 0 {
		slog.WarnContext(ctx, "no PROBE_URLS configured; skipping checks")
		return nil
	}
	for {
		var due []repository.DueMonitor
		if err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
			due, err = repository.ClaimDueMonitors(ctx, tx, claimBatch, claimLease)
			return err
		}); err != nil {
			return err
		}
		if len(due) > 0 {
			if err := s.dispatch(ctx, due); err != nil {
				return err
			}
		}
		if len(due) < claimBatch {
			break
		}
	}
	return s.runDueSynthetics(ctx)
}

// dispatch probes the claimed monitors and records their ticks; when the
// pass fails the leases end at once, so the next pass retries the same slots.
func (s *Services) dispatch(ctx context.Context, due []repository.DueMonitor) error {
	err := s.relay(ctx, s.probe(ctx, due), due)
	if err == nil {
		return nil
	}
	ids := make([]string, len(due))
	for i, m := range due {
		ids[i] = m.ID
	}
	rctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 10*time.Second)
	defer cancel()
	if rerr := s.DB.AsSystem(rctx, func(tx pgx.Tx) error { return repository.ReleaseMonitors(rctx, tx, ids) }); rerr != nil {
		slog.WarnContext(ctx, "monitor leases not released; they lapse on their own", "monitors", len(ids), "error", rerr)
	}
	return err
}

// probe calls every region for every monitor concurrently; each call waits
// at most timeout + 5 s, and a region that doesn't answer is "missing",
// never a failure.
func (s *Services) probe(ctx context.Context, due []repository.DueMonitor) []CheckResult {
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, maxInFlight)
	results := make([]CheckResult, 0, len(due)*len(s.Config.Probes))
	for _, m := range due {
		regions := m.Regions
		if len(regions) == 0 {
			regions = s.Config.Regions()
		}
		tick := tickID(m.ID, m.ScheduledAt)
		for _, region := range regions {
			wg.Add(1)
			sem <- struct{}{}
			go func() {
				defer func() { <-sem; wg.Done() }()
				cctx, cancel := context.WithTimeout(ctx, time.Duration(m.TimeoutS+5)*time.Second)
				defer cancel()
				r := CheckResult{TickID: tick, MonitorID: m.ID, OrgID: m.OrgID, Region: region, ScheduledAt: m.ScheduledAt.UTC(),
					TimeoutS: m.TimeoutS}
				res, err := s.Prober.Check(cctx, region, CheckRequest{JobID: tick, Target: m.Target, TimeoutS: m.TimeoutS})
				r.CheckedAt = s.Now().UTC()
				if err != nil {
					slog.WarnContext(ctx, "probe gave no answer", "region", region, "monitor_id", m.ID, "error", err)
					r.Missing, r.Cause = true, "error"
				} else {
					r.OK, r.Cause, r.StatusCode = res.OK, res.Cause, res.StatusCode
					r.DNSMs, r.ConnectMs, r.TLSMs, r.TTFBMs, r.TotalMs = res.DNSMs, res.ConnectMs, res.TLSMs, res.TTFBMs, res.TotalMs
					r.CertNotAfter = res.CertNotAfter
				}
				mu.Lock()
				results = append(results, r)
				mu.Unlock()
			}()
		}
	}
	wg.Wait()
	return results
}

// relay publishes each region's result to analytics through the outbox,
// keeps the list view's last response, records the claimed ticks as
// dispatched in the same transaction, and copies the answered results to
// the telemetry plane.
func (s *Services) relay(ctx context.Context, results []CheckResult, due []repository.DueMonitor) error {
	expected := map[string][]string{}
	for _, r := range results {
		expected[r.TickID] = append(expected[r.TickID], r.Region)
	}
	err := s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		for _, r := range results {
			payload := map[string]any{
				"tick_id": r.TickID, "monitor_id": r.MonitorID, "org_id": r.OrgID, "region": r.Region,
				"regions_expected": expected[r.TickID], "scheduled_at": r.ScheduledAt, "checked_at": r.CheckedAt,
				"ok": r.OK, "missing": r.Missing, "cause": r.Cause, "status_code": r.StatusCode,
				"dns_ms": r.DNSMs, "connect_ms": r.ConnectMs, "tls_ms": r.TLSMs, "ttfb_ms": r.TTFBMs, "total_ms": r.TotalMs,
				"cert_not_after": r.CertNotAfter, "timeout_s": max(1, r.TimeoutS),
			}
			if r.OK {
				payload["cause"] = ""
			}
			if err := repository.Enqueue(ctx, tx, bus.EventSyntheticResult, r.MonitorID, r.TickID+":"+r.Region, payload); err != nil {
				return err
			}
			if !r.Missing {
				if err := repository.RecordCheck(ctx, tx, r.MonitorID, r.CheckedAt, int(r.TotalMs), r.StatusCode); err != nil {
					return err
				}
			}
		}
		return repository.CompleteMonitors(ctx, tx, due)
	})
	if err != nil {
		return err
	}
	if s.Results != nil {
		answered := results[:0:0]
		for _, r := range results {
			if !r.Missing {
				answered = append(answered, r)
			}
		}
		if err := s.Results.Send(ctx, answered); err != nil {
			// The bars miss these points; the alerting path above is intact.
			slog.WarnContext(ctx, "check results not loaded into telemetry", "results", len(answered), "error", err)
		}
	}
	return nil
}

func (s *Services) runDueSynthetics(ctx context.Context) error {
	var due []repository.DueSynthetic
	if err := s.DB.AsSystem(ctx, func(tx pgx.Tx) (err error) {
		due, err = repository.ClaimDueSynthetics(ctx, tx, 100, claimLease)
		return err
	}); err != nil {
		return err
	}
	// A check whose run could not be stored keeps its lease and is retried
	// when it lapses.
	done := make([]repository.DueSynthetic, 0, len(due))
	for _, d := range due {
		if _, err := s.runSynthetic(ctx, d.Check); err != nil {
			slog.WarnContext(ctx, "synthetic run failed", "check_id", d.Check.ID, "error", err)
			continue
		}
		done = append(done, d)
	}
	cctx := context.WithoutCancel(ctx)
	return s.DB.AsSystem(cctx, func(tx pgx.Tx) error { return repository.CompleteSynthetics(cctx, tx, done) })
}

// Prune is the retention job: published outbox rows (failed ones are retried
// a few times, then kept for a month), old result claims,
// expired sign-in handoffs, synthetic runs past 90 days, and claim-check
// objects past a day (shared messaging contract, Operations).
func (s *Services) Prune(ctx context.Context) error {
	objects, err := s.Store.List(ctx, store.ComputePrefix(s.Store))
	if err != nil {
		return err
	}
	cutoff := s.Now().Add(-24 * time.Hour)
	for _, o := range objects {
		if o.Created.Before(cutoff) {
			if err := s.Store.Delete(ctx, o.Key); err != nil {
				return err
			}
		}
	}
	return s.DB.AsSystem(ctx, func(tx pgx.Tx) error {
		if _, err := repository.PruneOutbox(ctx, tx, 7*24*time.Hour, 30*24*time.Hour); err != nil {
			return err
		}
		if _, err := repository.RequeueFailedOutbox(ctx, tx, 3, time.Hour); err != nil {
			return err
		}
		if _, err := repository.PruneConsumerFailures(ctx, tx, 30*24*time.Hour); err != nil {
			return err
		}
		if _, err := repository.PruneClaims(ctx, tx, 7*24*time.Hour); err != nil {
			return err
		}
		if _, err := repository.PruneHandoffs(ctx, tx); err != nil {
			return err
		}
		_, err := repository.PruneRuns(ctx, tx, 90*24*time.Hour)
		return err
	})
}
