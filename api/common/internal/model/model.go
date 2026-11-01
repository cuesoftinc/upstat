// Package model holds the control-plane resources in the shape the HTTP API
// serves them: the web's models (web/src/models/*.ts) and its mock server
// are the contract (system-design.md §7.3), so field names match them.
package model

import (
	"encoding/json"
	"time"
)

type Org struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Timezone  string    `json:"timezone"`
	CreatedAt time.Time `json:"created_at"`
}

type Onboarding struct {
	OrgCreated bool   `json:"org_created"`
	HasData    bool   `json:"has_data"`
	IngestKey  string `json:"ingest_key,omitempty"`
}

type Member struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Status string `json:"status"`
	// UserID is internal: the account behind an active membership.
	UserID string `json:"-"`
}

type APIKey struct {
	ID             string    `json:"id"`
	Kind           string    `json:"kind"`
	Name           string    `json:"name"`
	Scope          string    `json:"scope"`
	KeyMasked      string    `json:"key_masked"`
	Status         string    `json:"status"`
	CreatedAt      time.Time `json:"created_at"`
	RejectedCount  int64     `json:"rejected_count"`
	AllowedOrigins []string  `json:"allowed_origins"`
	// Key is the plaintext, present only on create and rotate.
	Key string `json:"key,omitempty"`
}

type Monitor struct {
	ID                  string     `json:"id"`
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
	Regions             []string   `json:"regions"`
	MinFailingRegions   int        `json:"min_failing_regions"`
	LastCheckedAt       *time.Time `json:"last_checked_at"`
	LastResponseTimeMs  *int       `json:"last_response_time_ms"`
	LastStatusCode      *int       `json:"last_status_code"`
	CreatedAt           time.Time  `json:"created_at"`
	UpdatedAt           time.Time  `json:"updated_at"`

	OrgID             string `json:"-"`
	LastTransitionSeq int64  `json:"-"`
}

type Channel struct {
	ID          string    `json:"id"`
	Kind        string    `json:"kind"`
	Name        string    `json:"name,omitempty"`
	Target      string    `json:"target"`
	Health      string    `json:"health"`
	FailureNote string    `json:"failure_note,omitempty"`
	CreatedAt   time.Time `json:"created_at"`

	OrgID  string `json:"-"`
	Secret string `json:"-"`
}

type Thresholds struct {
	Warn   *float64 `json:"warn"`
	Crit   float64  `json:"crit"`
	Window string   `json:"window"`
}

type MuteWindow struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type Notify struct {
	ChannelIDs      []string     `json:"channel_ids"`
	CooldownMinutes int          `json:"cooldown_minutes"`
	RenotifyMinutes int          `json:"renotify_minutes"`
	MuteWindows     []MuteWindow `json:"mute_windows"`
}

type Rule struct {
	ID              string          `json:"id"`
	OrgID           string          `json:"org_id"`
	Name            string          `json:"name"`
	Signal          string          `json:"signal"`
	Query           json.RawMessage `json:"query"`
	QueryString     string          `json:"query_string"`
	Thresholds      Thresholds      `json:"thresholds"`
	Notify          Notify          `json:"notify"`
	State           string          `json:"state"`
	LastTriggeredAt *time.Time      `json:"last_triggered_at"`
}

type AlertEvent struct {
	ID          string    `json:"id"`
	TS          time.Time `json:"ts"`
	Sev         string    `json:"sev"`
	RuleID      string    `json:"rule_id"`
	MonitorName string    `json:"monitor_name"`
	Message     string    `json:"message"`
	Unread      bool      `json:"unread"`
	State       string    `json:"state"`
}

type IncidentRoles struct {
	Commander  string   `json:"commander"`
	Responders []string `json:"responders"`
}

type Incident struct {
	ID            string        `json:"id"`
	OrgID         string        `json:"org_id"`
	Key           string        `json:"key"`
	Title         string        `json:"title"`
	Sev           int           `json:"sev"`
	Status        string        `json:"status"`
	Roles         IncidentRoles `json:"roles"`
	StartedAt     time.Time     `json:"started_at"`
	ResolvedAt    *time.Time    `json:"resolved_at"`
	PostmortemKey *string       `json:"postmortem_key"`
	Services      []string      `json:"services"`
	Source        string        `json:"source"`
	MonitorID     *string       `json:"monitor_id,omitempty"`
}

type TimelineEntry struct {
	ID         string    `json:"id"`
	IncidentID string    `json:"incident_id"`
	TS         time.Time `json:"ts"`
	Author     string    `json:"author"`
	Phase      string    `json:"phase"`
	Body       string    `json:"body"`
}

type PostmortemEvent struct {
	TS     time.Time `json:"ts"`
	Phase  string    `json:"phase"`
	Author string    `json:"author"`
	Body   string    `json:"body"`
}

type Postmortem struct {
	IncidentID  string            `json:"incident_id"`
	Title       string            `json:"title"`
	Author      string            `json:"author"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
	Impact      string            `json:"impact"`
	RootCause   string            `json:"root_cause"`
	ActionItems []string          `json:"action_items"`
	Timeline    []PostmortemEvent `json:"timeline"`
}

type SLO struct {
	ID                 string     `json:"id"`
	OrgID              string     `json:"org_id"`
	Name               string     `json:"name"`
	SLISource          string     `json:"sli_source"`
	Target             float64    `json:"target"`
	Window             string     `json:"window"`
	Current            float64    `json:"current"`
	BudgetRemainingPct float64    `json:"budget_remaining_pct"`
	BurnRate           float64    `json:"burn_rate"`
	State              string     `json:"state"`
	ExhaustedAt        *time.Time `json:"exhausted_at,omitempty"`
	MonitorID          *string    `json:"monitor_id,omitempty"`
	Query              string     `json:"query,omitempty"`
}

type WidgetLayout struct {
	X int `json:"x"`
	Y int `json:"y"`
	W int `json:"w"`
	H int `json:"h"`
}

type Widget struct {
	ID          string          `json:"id"`
	DashboardID string          `json:"dashboard_id"`
	Type        string          `json:"type"`
	Title       string          `json:"title"`
	Query       json.RawMessage `json:"query"`
	QueryString *string         `json:"query_string,omitempty"`
	VizOptions  json.RawMessage `json:"viz_options"`
	Layout      WidgetLayout    `json:"layout"`
}

type Dashboard struct {
	ID           string              `json:"id"`
	OrgID        string              `json:"org_id"`
	Name         string              `json:"name"`
	Favorite     bool                `json:"favorite"`
	Shared       bool                `json:"shared"`
	TemplateVars map[string][]string `json:"template_vars"`
	Widgets      []Widget            `json:"widgets"`
	UpdatedAt    time.Time           `json:"updated_at"`
}

type SavedView struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Scope      string    `json:"scope"`
	Surface    string    `json:"surface"`
	Query      string    `json:"query"`
	SharedWith []string  `json:"shared_with,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type TelemetryPresence struct {
	Metrics bool `json:"metrics"`
	Logs    bool `json:"logs"`
	Traces  bool `json:"traces"`
	RUM     bool `json:"rum"`
}

type CatalogLinks struct {
	Repo    string `json:"repo,omitempty"`
	Runbook string `json:"runbook,omitempty"`
}

type CatalogEntry struct {
	ID           string            `json:"id"`
	Name         string            `json:"name"`
	Owner        string            `json:"owner"`
	Links        CatalogLinks      `json:"links"`
	Environments []string          `json:"environments"`
	Telemetry    TelemetryPresence `json:"telemetry"`
}

type StatusComponentConfig struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	MonitorID *string `json:"monitor_id"`
}

type StatusPageConfig struct {
	Name       string                  `json:"name"`
	Slug       string                  `json:"slug"`
	Components []StatusComponentConfig `json:"components"`
}

type UptimeDay struct {
	Date        string   `json:"date"`
	UptimePct   *float64 `json:"uptime_pct"`
	DownMinutes int      `json:"down_minutes"`
}

type StatusComponent struct {
	Name      string      `json:"name"`
	Status    string      `json:"status"`
	Days      []UptimeDay `json:"days"`
	UptimePct *float64    `json:"uptime_pct"`
	P95Ms     *float64    `json:"p95_ms"`
}

type StatusIncidentUpdate struct {
	TS    time.Time `json:"ts"`
	Phase string    `json:"phase"`
	Body  string    `json:"body"`
}

type StatusIncident struct {
	Key       string                 `json:"key"`
	Title     string                 `json:"title"`
	Sev       int                    `json:"sev"`
	Status    string                 `json:"status"`
	StartedAt time.Time              `json:"started_at"`
	Updates   []StatusIncidentUpdate `json:"updates"`
}

type StatusPage struct {
	Slug       string            `json:"slug"`
	OrgName    string            `json:"org_name"`
	Overall    string            `json:"overall"`
	UpdatedAt  time.Time         `json:"updated_at"`
	Components []StatusComponent `json:"components"`
	Incidents  []StatusIncident  `json:"incidents"`
}

type SyntheticStep struct {
	ID         string `json:"id"`
	Kind       string `json:"kind"`
	Summary    string `json:"summary"`
	Method     string `json:"method,omitempty"`
	URL        string `json:"url,omitempty"`
	Expression string `json:"expression,omitempty"`
	WaitMs     *int   `json:"wait_ms,omitempty"`
}

type BrowserConfig struct {
	URL                 string `json:"url"`
	Viewport            string `json:"viewport"`
	ScreenshotOnFailure bool   `json:"screenshot_on_failure"`
}

type SyntheticCheck struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Kind            string          `json:"kind"`
	Steps           []SyntheticStep `json:"steps"`
	Browser         *BrowserConfig  `json:"browser"`
	IntervalSeconds int             `json:"interval_seconds"`
	LastRunID       *string         `json:"last_run_id"`
	LastRunStatus   *string         `json:"last_run_status"`
	LastRunAt       *time.Time      `json:"last_run_at"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`

	OrgID string `json:"-"`
}

type SyntheticStepResult struct {
	Index      int    `json:"index"`
	Kind       string `json:"kind"`
	Summary    string `json:"summary"`
	Status     string `json:"status"`
	DurationMs int    `json:"duration_ms"`
}

type FailureScreenshot struct {
	StepIndex int    `json:"step_index"`
	Viewport  string `json:"viewport"`
}

type SyntheticRun struct {
	ID                string                `json:"id"`
	CheckID           string                `json:"check_id"`
	Number            int                   `json:"number"`
	Status            string                `json:"status"`
	StartedAt         time.Time             `json:"started_at"`
	TotalMs           int                   `json:"total_ms"`
	Steps             []SyntheticStepResult `json:"steps"`
	StepsTotal        int                   `json:"steps_total"`
	FailureScreenshot *FailureScreenshot    `json:"failure_screenshot"`
}

type Insight struct {
	ID                string    `json:"id"`
	MonitorID         string    `json:"monitor_id"`
	RiskScore         int       `json:"risk_score"`
	Severity          string    `json:"severity"`
	AnomalyDetected   bool      `json:"anomaly_detected"`
	Summary           string    `json:"summary"`
	Narrative         string    `json:"narrative"`
	RecommendedAction string    `json:"recommended_action"`
	GeneratedAt       time.Time `json:"generated_at"`
}

type RegistryEvent struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Dims             []string `json:"dims"`
	UniqueIneligible bool     `json:"unique_ineligible"`
}
