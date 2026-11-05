package telemetry

import (
	"context"
	"math"
	"time"

	"github.com/cuesoftinc/upstat/api/query/internal/chdb"
)

// Uptime reads for api/common (§6.7) and the monitor page (B7). Uptime %
// is passing ÷ completed region results; days with no result are gaps
// (null), never zero (flows/monitor.md §3).

type UptimeDay struct {
	Date        string   `json:"date"`
	UptimePct   *float64 `json:"uptime_pct"`
	DownMinutes int      `json:"down_minutes"`
}

type CheckResult struct {
	ID             string    `json:"id"`
	MonitorID      string    `json:"monitor_id"`
	Up             bool      `json:"up"`
	StatusCode     int       `json:"status_code"`
	ResponseTimeMs float64   `json:"response_time_ms"`
	CheckedAt      time.Time `json:"checked_at"`
	Region         string    `json:"region"`
	Cause          string    `json:"cause"`
}

type History struct {
	MonitorID    string        `json:"monitor_id"`
	Days         []UptimeDay   `json:"days"`
	RecentChecks []CheckResult `json:"recent_checks"`
	Uptime90dPct *float64      `json:"uptime_90d_pct"`
}

type UptimeSummary struct {
	Days      []UptimeDay `json:"days"`
	UptimePct *float64    `json:"uptime_pct"`
	P95Ms     *float64    `json:"p95_ms"`
}

func pct(passing, checks float64) *float64 {
	if checks == 0 {
		return nil
	}
	v := math.Round(passing/checks*100000) / 1000
	return &v
}

// days reads the daily strips of several monitors.
func (s *Service) days(ctx context.Context, orgID string, ids []string, n int) (map[string][]UptimeDay, map[string]*float64, error) {
	now := s.Now().UTC()
	first := now.AddDate(0, 0, -(n - 1)).Truncate(24 * time.Hour)
	rows, err := s.CH.Rows(ctx, orgID, `SELECT monitor_id, day, sum(checks) AS checks, sum(passing) AS passing FROM check_uptime_daily
		WHERE org_id = {o:String} AND monitor_id IN {ids:Array(String)} AND day >= toDate({f:DateTime64(3)}) GROUP BY monitor_id, day`,
		map[string]string{"o": orgID, "f": ts(first), "ids": chdb.ArrayParam(ids)})
	if err != nil {
		return nil, nil, err
	}
	type tally struct{ checks, passing float64 }
	byDay := map[string]map[string]tally{}
	total := map[string]tally{}
	for _, r := range rows {
		id := chdb.Str(r["monitor_id"])
		if byDay[id] == nil {
			byDay[id] = map[string]tally{}
		}
		t := tally{f(r, "checks"), f(r, "passing")}
		byDay[id][chdb.Time(r["day"]).Format("2006-01-02")] = t
		tot := total[id]
		total[id] = tally{tot.checks + t.checks, tot.passing + t.passing}
	}
	strips := map[string][]UptimeDay{}
	overall := map[string]*float64{}
	for _, id := range ids {
		strip := make([]UptimeDay, 0, n)
		for d := first; !d.After(now); d = d.AddDate(0, 0, 1) {
			key := d.Format("2006-01-02")
			t := byDay[id][key]
			day := UptimeDay{Date: key, UptimePct: pct(t.passing, t.checks)}
			if t.checks > 0 {
				day.DownMinutes = int(math.Round((t.checks - t.passing) / t.checks * 1440))
			}
			strip = append(strip, day)
		}
		strips[id] = strip
		overall[id] = pct(total[id].passing, total[id].checks)
	}
	return strips, overall, nil
}

// History is GET /v1/monitors/{id}/checks, read for api/common.
func (s *Service) History(ctx context.Context, orgID, monitorID string) (*History, error) {
	strips, overall, err := s.days(ctx, orgID, []string{monitorID}, 90)
	if err != nil {
		return nil, err
	}
	rows, err := s.CH.Rows(ctx, orgID, `SELECT tick_id, region, ok, status_code, total_ms, checked_at, cause FROM check_results
		WHERE org_id = {o:String} AND monitor_id = {m:String} AND scheduled_at >= {f:DateTime64(3)}
		ORDER BY scheduled_at DESC LIMIT 50`, map[string]string{"o": orgID, "m": monitorID, "f": ts(s.Now().Add(-7 * 24 * time.Hour))})
	if err != nil {
		return nil, err
	}
	h := &History{MonitorID: monitorID, Days: strips[monitorID], RecentChecks: []CheckResult{}, Uptime90dPct: overall[monitorID]}
	for i := len(rows) - 1; i >= 0; i-- { // oldest first, for the chart
		r := rows[i]
		h.RecentChecks = append(h.RecentChecks, CheckResult{ID: chdb.Str(r["tick_id"]) + ":" + chdb.Str(r["region"]), MonitorID: monitorID,
			Up: f(r, "ok") == 1, StatusCode: int(f(r, "status_code")), ResponseTimeMs: math.Round(f(r, "total_ms")),
			CheckedAt: chdb.Time(r["checked_at"]), Region: chdb.Str(r["region"]), Cause: chdb.Str(r["cause"])})
	}
	return h, nil
}

// Uptime is the status page's strips plus each monitor's 24 h p95.
func (s *Service) Uptime(ctx context.Context, orgID string, ids []string, n int) (map[string]UptimeSummary, error) {
	out := map[string]UptimeSummary{}
	if len(ids) == 0 {
		return out, nil
	}
	if n <= 0 || n > 400 {
		n = 90
	}
	strips, overall, err := s.days(ctx, orgID, ids, n)
	if err != nil {
		return nil, err
	}
	rows, err := s.CH.Rows(ctx, orgID, `SELECT monitor_id, quantile(0.95)(total_ms) AS p95 FROM check_results
		WHERE org_id = {o:String} AND monitor_id IN {ids:Array(String)} AND scheduled_at >= {f:DateTime64(3)} AND ok GROUP BY monitor_id`,
		map[string]string{"o": orgID, "f": ts(s.Now().Add(-24 * time.Hour)), "ids": chdb.ArrayParam(ids)})
	if err != nil {
		return nil, err
	}
	p95 := map[string]*float64{}
	for _, r := range rows {
		v := math.Round(f(r, "p95"))
		p95[chdb.Str(r["monitor_id"])] = &v
	}
	for _, id := range ids {
		out[id] = UptimeSummary{Days: strips[id], UptimePct: overall[id], P95Ms: p95[id]}
	}
	return out, nil
}

// HasData reports whether the org has sent any telemetry (onboarding B1).
func (s *Service) HasData(ctx context.Context, orgID string) (bool, error) {
	rows, err := s.CH.Rows(ctx, orgID, `SELECT 1 FROM (
			SELECT org_id FROM otel_logs WHERE org_id = {o:String} AND ServiceName NOT LIKE 'upstat.%' LIMIT 1
			UNION ALL SELECT org_id FROM otel_traces WHERE org_id = {o:String} LIMIT 1
			UNION ALL SELECT org_id FROM otel_metrics_gauge WHERE org_id = {o:String} LIMIT 1
			UNION ALL SELECT org_id FROM otel_metrics_sum WHERE org_id = {o:String} LIMIT 1
			UNION ALL SELECT org_id FROM events WHERE org_id = {o:String} LIMIT 1) LIMIT 1`, map[string]string{"o": orgID})
	return len(rows) > 0, err
}

type Presence struct {
	Metrics bool `json:"metrics"`
	Logs    bool `json:"logs"`
	Traces  bool `json:"traces"`
	RUM     bool `json:"rum"`
}

// Presence is which signals each catalog service sent in the last day
// (B11); RUM is per property, not per service, so it stays false here.
func (s *Service) Presence(ctx context.Context, orgID string, services []string) (map[string]Presence, error) {
	out := map[string]Presence{}
	for _, svc := range services {
		out[svc] = Presence{}
	}
	if len(services) == 0 {
		return out, nil
	}
	rows, err := s.CH.Rows(ctx, orgID, `SELECT 'metrics' AS k, ServiceName AS s FROM metrics_1h WHERE org_id = {o:String} AND bucket >= {f:DateTime64(3)} GROUP BY s
		UNION ALL SELECT 'logs', ServiceName FROM otel_logs WHERE org_id = {o:String} AND Timestamp >= {f:DateTime64(3)} GROUP BY ServiceName
		UNION ALL SELECT 'traces', ServiceName FROM otel_traces WHERE org_id = {o:String} AND Timestamp >= {f:DateTime64(3)} GROUP BY ServiceName`,
		map[string]string{"o": orgID, "f": ts(s.Now().Add(-24 * time.Hour))})
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		svc := chdb.Str(r["s"])
		p, ok := out[svc]
		if !ok {
			continue
		}
		switch chdb.Str(r["k"]) {
		case "metrics":
			p.Metrics = true
		case "logs":
			p.Logs = true
		case "traces":
			p.Traces = true
		}
		out[svc] = p
	}
	return out, nil
}
