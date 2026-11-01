package service

import "github.com/cuesoftinc/upstat/api/common/internal/model"

// UptimeSummary is one monitor's 90-day strip from api/query.
type UptimeSummary struct {
	Days      []model.UptimeDay `json:"days"`
	UptimePct *float64          `json:"uptime_pct"`
	P95Ms     *float64          `json:"p95_ms"`
}

// Presence is which signals a service has sent recently.
type Presence struct {
	Metrics bool `json:"metrics"`
	Logs    bool `json:"logs"`
	Traces  bool `json:"traces"`
	RUM     bool `json:"rum"`
}

// ReplayRequest asks api/query for the MI-9 24 h replay.
type ReplayRequest struct {
	Signal          string           `json:"signal"`
	MonitorID       string           `json:"monitor_id,omitempty"`
	QueryString     string           `json:"query_string"`
	Thresholds      model.Thresholds `json:"thresholds"`
	CooldownMinutes int              `json:"cooldown_minutes"`
}
