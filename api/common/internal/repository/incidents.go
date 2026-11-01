package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

const incidentColumns = `id, org_id, number, title, sev, status, commander, responders, started_at, resolved_at, postmortem_key,
	services, source, monitor_id`

func scanIncident(r pgx.Row) (*model.Incident, error) {
	var i model.Incident
	var number int
	if err := r.Scan(&i.ID, &i.OrgID, &number, &i.Title, &i.Sev, &i.Status, &i.Roles.Commander, &i.Roles.Responders,
		&i.StartedAt, &i.ResolvedAt, &i.PostmortemKey, &i.Services, &i.Source, &i.MonitorID); err != nil {
		return nil, err
	}
	i.Key = fmt.Sprintf("INC-%d", number)
	return &i, nil
}

func ListIncidents(ctx context.Context, tx pgx.Tx) ([]model.Incident, error) {
	rows, err := tx.Query(ctx, `SELECT `+incidentColumns+` FROM incidents ORDER BY started_at DESC`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanIncident)
}

func GetIncident(ctx context.Context, tx pgx.Tx, id string) (*model.Incident, error) {
	return one(tx.QueryRow(ctx, `SELECT `+incidentColumns+` FROM incidents WHERE id = $1`, id), scanIncident)
}

// NewIncident declares an incident with the org's next INC number and its
// first timeline entry.
type NewIncident struct {
	OrgID, Title, Commander, Source, Cause, FirstEntry string
	Sev                                                int
	MonitorID                                          *string
	StartedAt                                          time.Time
	Services                                           []string
}

func CreateIncident(ctx context.Context, tx pgx.Tx, n NewIncident) (*model.Incident, error) {
	// Serialize numbering per org: the unique (org_id, number) is the guard,
	// the lock avoids retries.
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('incident:' || $1))`, n.OrgID); err != nil {
		return nil, err
	}
	if n.Services == nil {
		n.Services = []string{}
	}
	inc, err := one(tx.QueryRow(ctx, `INSERT INTO incidents (org_id, number, title, sev, status, commander, source, monitor_id, cause,
			services, started_at)
		VALUES ($1, coalesce((SELECT max(number) FROM incidents WHERE org_id = $1), 0) + 1, $2, $3, 'investigating', $4, $5, $6, $7, $8, $9)
		RETURNING `+incidentColumns, n.OrgID, n.Title, n.Sev, n.Commander, n.Source, n.MonitorID, n.Cause, n.Services, n.StartedAt), scanIncident)
	if err != nil {
		return nil, err
	}
	if _, err := AddTimeline(ctx, tx, inc.OrgID, inc.ID, n.Commander, "investigating", n.FirstEntry, n.StartedAt); err != nil {
		return nil, err
	}
	return inc, nil
}

type IncidentPatch struct {
	Title, Status, PostmortemKey *string
	Sev                          *int
	Roles                        *model.IncidentRoles
	Services                     *[]string
}

func UpdateIncident(ctx context.Context, tx pgx.Tx, id string, p IncidentPatch, now time.Time) (*model.Incident, error) {
	var commander, responders, services any
	if p.Roles != nil {
		commander, responders = p.Roles.Commander, p.Roles.Responders
	}
	if p.Services != nil {
		services = *p.Services
	}
	return one(tx.QueryRow(ctx, `UPDATE incidents SET title = coalesce($2, title), sev = coalesce($3, sev),
			commander = coalesce($4, commander), responders = coalesce($5::text[], responders),
			services = coalesce($6::text[], services), postmortem_key = coalesce($7, postmortem_key),
			resolved_at = CASE WHEN $8::text IS NULL THEN resolved_at WHEN $8 = 'resolved' THEN coalesce(resolved_at, $9) ELSE NULL END,
			status = coalesce($8, status)
		WHERE id = $1 RETURNING `+incidentColumns, id, p.Title, p.Sev, commander, responders, services, p.PostmortemKey, p.Status, now),
		scanIncident)
}

// OpenMonitorIncident is the monitor's open auto-incident, or ErrNotFound.
func OpenMonitorIncident(ctx context.Context, tx pgx.Tx, monitorID string) (*model.Incident, error) {
	return one(tx.QueryRow(ctx, `SELECT `+incidentColumns+` FROM incidents
		WHERE monitor_id = $1 AND source = 'monitor' AND status <> 'resolved'`, monitorID), scanIncident)
}

func scanTimeline(r pgx.Row) (*model.TimelineEntry, error) {
	var t model.TimelineEntry
	return &t, r.Scan(&t.ID, &t.IncidentID, &t.TS, &t.Author, &t.Phase, &t.Body)
}

func AddTimeline(ctx context.Context, tx pgx.Tx, orgID, incidentID, author, phase, body string, at time.Time) (*model.TimelineEntry, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO timeline_entries (org_id, incident_id, ts, author, phase, body)
		VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, incident_id, ts, author, phase, body`,
		orgID, incidentID, at, author, phase, body), scanTimeline)
}

// Timeline lists an incident's entries; newestFirst for the feed, oldest
// first for the postmortem.
func Timeline(ctx context.Context, tx pgx.Tx, incidentID string, newestFirst bool) ([]model.TimelineEntry, error) {
	order := "ASC"
	if newestFirst {
		order = "DESC"
	}
	rows, err := tx.Query(ctx, `SELECT id, incident_id, ts, author, phase, body FROM timeline_entries
		WHERE incident_id = $1 ORDER BY ts `+order+`, id`, incidentID)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanTimeline)
}

// RecentIncidents feeds the public status page: open ones and those
// resolved within the window.
func RecentIncidents(ctx context.Context, tx pgx.Tx, since time.Time) ([]model.Incident, error) {
	rows, err := tx.Query(ctx, `SELECT `+incidentColumns+` FROM incidents
		WHERE status <> 'resolved' OR resolved_at >= $1 ORDER BY (status <> 'resolved') DESC, started_at DESC LIMIT 20`, since)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanIncident)
}
