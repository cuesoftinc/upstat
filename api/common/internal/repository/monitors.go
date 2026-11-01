package repository

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/cuesoftinc/upstat/api/common/internal/model"
)

// ── Monitors ────────────────────────────────────────────────────────────

const monitorColumns = `id, org_id, name, target, type, active, status, muted, interval_s, timeout_s, failure_threshold,
	consecutive_failures, regions, min_failing_regions, last_transition_seq, last_checked_at, last_response_time_ms,
	last_status_code, created_at, updated_at`

func scanMonitor(r pgx.Row) (*model.Monitor, error) {
	var m model.Monitor
	return &m, r.Scan(&m.ID, &m.OrgID, &m.Name, &m.Target, &m.Type, &m.Active, &m.Status, &m.Muted, &m.IntervalSeconds,
		&m.TimeoutSeconds, &m.FailureThreshold, &m.ConsecutiveFailures, &m.Regions, &m.MinFailingRegions,
		&m.LastTransitionSeq, &m.LastCheckedAt, &m.LastResponseTimeMs, &m.LastStatusCode, &m.CreatedAt, &m.UpdatedAt)
}

func ListMonitors(ctx context.Context, tx pgx.Tx) ([]model.Monitor, error) {
	rows, err := tx.Query(ctx, `SELECT `+monitorColumns+` FROM monitors ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanMonitor)
}

func GetMonitor(ctx context.Context, tx pgx.Tx, id string) (*model.Monitor, error) {
	return one(tx.QueryRow(ctx, `SELECT `+monitorColumns+` FROM monitors WHERE id = $1`, id), scanMonitor)
}

func CountMonitors(ctx context.Context, tx pgx.Tx) (int, error) {
	var n int
	return n, tx.QueryRow(ctx, `SELECT count(*) FROM monitors`).Scan(&n)
}

// CreateMonitor seeds next_run_at with hash jitter across the interval
// (flows/monitor.md §3: no thundering herd).
func CreateMonitor(ctx context.Context, tx pgx.Tx, orgID string, m model.Monitor) (*model.Monitor, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO monitors (org_id, name, target, type, interval_s, timeout_s, failure_threshold,
			regions, min_failing_regions, next_run_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
			now() + make_interval(secs => abs(hashtext(gen_random_uuid()::text)) % $5))
		RETURNING `+monitorColumns, orgID, m.Name, m.Target, m.Type, m.IntervalSeconds, m.TimeoutSeconds, m.FailureThreshold,
		m.Regions, m.MinFailingRegions), scanMonitor)
}

// MonitorPatch carries the editable fields; nil leaves a field alone.
type MonitorPatch struct {
	Name, Target, Type                         *string
	Active, Muted                              *bool
	IntervalSeconds, TimeoutSeconds, Threshold *int
	Regions                                    *[]string
	MinFailingRegions                          *int
}

// UpdateMonitor applies a patch. Pausing freezes status at paused and
// clears the failure count; resuming starts from pending with a fresh
// slate and checks at once (flows/monitor.md §2).
func UpdateMonitor(ctx context.Context, tx pgx.Tx, id string, p MonitorPatch) (*model.Monitor, error) {
	var regions any
	if p.Regions != nil {
		regions = *p.Regions
	}
	return one(tx.QueryRow(ctx, `UPDATE monitors SET
			name = coalesce($2, name), target = coalesce($3, target), type = coalesce($4, type),
			muted = coalesce($6, muted), interval_s = coalesce($7, interval_s), timeout_s = coalesce($8, timeout_s),
			failure_threshold = coalesce($9, failure_threshold), regions = coalesce($10::text[], regions),
			min_failing_regions = coalesce($11, min_failing_regions),
			status = CASE WHEN $5::boolean IS FALSE THEN 'paused'
				WHEN $5::boolean IS TRUE AND NOT active THEN 'pending' ELSE status END,
			consecutive_failures = CASE WHEN $5::boolean IS NOT NULL AND $5::boolean <> active THEN 0 ELSE consecutive_failures END,
			next_run_at = CASE WHEN $5::boolean IS TRUE AND NOT active THEN now() ELSE next_run_at END,
			active = coalesce($5, active), updated_at = now()
		WHERE id = $1 RETURNING `+monitorColumns,
		id, p.Name, p.Target, p.Type, p.Active, p.Muted, p.IntervalSeconds, p.TimeoutSeconds, p.Threshold, regions, p.MinFailingRegions),
		scanMonitor)
}

func DeleteMonitor(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM monitors WHERE id = $1`, id))
}

// DueMonitor is one check the scheduler claimed.
type DueMonitor struct {
	ID, OrgID, Name, Target string
	TimeoutS                int
	Regions                 []string
	ScheduledAt             time.Time
}

// ClaimDueMonitors is the scheduler's lookup-then-write (§6.1): it advances
// next_run_at for due monitors and returns them. SKIP LOCKED lets any number
// of instances schedule without double dispatch; a stale slot is skipped,
// so the next slot wins after downtime.
func ClaimDueMonitors(ctx context.Context, tx pgx.Tx, limit int) ([]DueMonitor, error) {
	rows, err := tx.Query(ctx, `WITH due AS (
			SELECT id FROM monitors WHERE active AND next_run_at <= now()
			ORDER BY next_run_at LIMIT $1 FOR UPDATE SKIP LOCKED)
		UPDATE monitors m SET next_run_at = m.next_run_at + make_interval(secs =>
			m.interval_s * (floor(extract(epoch FROM now() - m.next_run_at) / m.interval_s) + 1))
		FROM due WHERE m.id = due.id
		RETURNING m.id, m.org_id, m.name, m.target, m.timeout_s, m.regions,
			m.next_run_at - make_interval(secs => m.interval_s)`, limit)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Row) (*DueMonitor, error) {
		var d DueMonitor
		return &d, r.Scan(&d.ID, &d.OrgID, &d.Name, &d.Target, &d.TimeoutS, &d.Regions, &d.ScheduledAt)
	})
}

// RecordCheck stores the latest response a region reported, for the list
// view (status itself only changes on a transition).
func RecordCheck(ctx context.Context, tx pgx.Tx, id string, at time.Time, responseMs, statusCode int) error {
	_, err := tx.Exec(ctx, `UPDATE monitors SET last_checked_at = $2, last_response_time_ms = $3, last_status_code = $4
		WHERE id = $1 AND (last_checked_at IS NULL OR last_checked_at <= $2)`, id, at, responseMs, statusCode)
	return err
}

// ── Transitions (persisting what the evaluator decided) ─────────────────

type Transition struct {
	ID, OrgID, MonitorID, From, To, Cause string
	Seq                                   int64
	Regions                               map[string]bool
	ConsecutiveFailures                   int
	At                                    time.Time
}

// InsertTransition stores a transition once; false when (monitor, seq) was
// already recorded (redelivery).
func InsertTransition(ctx context.Context, tx pgx.Tx, t Transition) (bool, error) {
	tag, err := tx.Exec(ctx, `INSERT INTO transitions (id, org_id, monitor_id, seq, from_status, to_status, cause, regions,
			consecutive_failures, at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) ON CONFLICT DO NOTHING`,
		t.ID, t.OrgID, t.MonitorID, t.Seq, t.From, t.To, t.Cause, mustJSON(t.Regions), t.ConsecutiveFailures, t.At)
	if err != nil {
		return false, translate(err)
	}
	return tag.RowsAffected() == 1, nil
}

// ApplyTransition materializes the monitor's status from its newest
// transition; an older one (out of order) leaves it alone. A paused
// monitor keeps paused.
func ApplyTransition(ctx context.Context, tx pgx.Tx, t Transition) (bool, error) {
	tag, err := tx.Exec(ctx, `UPDATE monitors SET status = $2, consecutive_failures = $3, last_transition_seq = $4, updated_at = now()
		WHERE id = $1 AND last_transition_seq < $4 AND active`, t.MonitorID, t.To, t.ConsecutiveFailures, t.Seq)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() == 1, nil
}

func MonitorName(ctx context.Context, tx pgx.Tx, id string) (string, error) {
	var name string
	return name, translate(tx.QueryRow(ctx, `SELECT name FROM monitors WHERE id = $1`, id).Scan(&name))
}

// ── Insights ────────────────────────────────────────────────────────────

func InsertInsight(ctx context.Context, tx pgx.Tx, orgID string, i model.Insight) error {
	_, err := tx.Exec(ctx, `INSERT INTO insights (id, org_id, monitor_id, risk_score, severity, anomaly_detected, summary,
			narrative, recommended_action, generated_at)
		SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10 WHERE EXISTS (SELECT 1 FROM monitors WHERE id = $3)
		ON CONFLICT (id) DO NOTHING`, i.ID, orgID, i.MonitorID, i.RiskScore, i.Severity, i.AnomalyDetected, i.Summary,
		i.Narrative, i.RecommendedAction, i.GeneratedAt)
	return err
}

func ListInsights(ctx context.Context, tx pgx.Tx, monitorID string, limit int) ([]model.Insight, error) {
	rows, err := tx.Query(ctx, `SELECT id, monitor_id, risk_score, severity, anomaly_detected, summary, narrative,
			recommended_action, generated_at FROM insights WHERE monitor_id = $1 ORDER BY generated_at DESC LIMIT $2`, monitorID, limit)
	if err != nil {
		return nil, err
	}
	return collect(rows, func(r pgx.Row) (*model.Insight, error) {
		var i model.Insight
		return &i, r.Scan(&i.ID, &i.MonitorID, &i.RiskScore, &i.Severity, &i.AnomalyDetected, &i.Summary, &i.Narrative,
			&i.RecommendedAction, &i.GeneratedAt)
	})
}

// ── Ingest keys and the event registry ──────────────────────────────────

const keyColumns = `id, kind, name, scope, key_masked, status, created_at, rejected_count, allowed_origins`

func scanKey(r pgx.Row) (*model.APIKey, error) {
	var k model.APIKey
	var origins []byte
	if err := r.Scan(&k.ID, &k.Kind, &k.Name, &k.Scope, &k.KeyMasked, &k.Status, &k.CreatedAt, &k.RejectedCount, &origins); err != nil {
		return nil, err
	}
	k.AllowedOrigins = []string{}
	_ = json.Unmarshal(origins, &k.AllowedOrigins)
	return &k, nil
}

// ListKeys lists keys, reporting a rotated key as active again once its
// grace window has passed.
func ListKeys(ctx context.Context, tx pgx.Tx) ([]model.APIKey, error) {
	rows, err := tx.Query(ctx, `SELECT id, kind, name, scope, key_masked,
			CASE WHEN status = 'rotation_grace' AND previous_expires_at < now() THEN 'active' ELSE status END,
			created_at, rejected_count, allowed_origins FROM ingest_keys ORDER BY created_at`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanKey)
}

func GetKey(ctx context.Context, tx pgx.Tx, id string) (*model.APIKey, error) {
	return one(tx.QueryRow(ctx, `SELECT `+keyColumns+` FROM ingest_keys WHERE id = $1`, id), scanKey)
}

func CreateKey(ctx context.Context, tx pgx.Tx, orgID, kind, name, scope, hash, masked string, origins []string) (*model.APIKey, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO ingest_keys (org_id, kind, name, scope, key_hash, key_masked, allowed_origins)
		VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING `+keyColumns, orgID, kind, name, scope, hash, masked, mustJSON(origins)), scanKey)
}

// RotateKey swaps in a new hash; the old one stays valid for grace
// (the rotation contract: 24 h).
func RotateKey(ctx context.Context, tx pgx.Tx, id, hash, masked string, grace time.Duration) (*model.APIKey, error) {
	return one(tx.QueryRow(ctx, `UPDATE ingest_keys SET previous_hash = key_hash, previous_expires_at = now() + make_interval(secs => $4),
			key_hash = $2, key_masked = $3, status = 'rotation_grace'
		WHERE id = $1 AND status <> 'revoked' RETURNING `+keyColumns, id, hash, masked, grace.Seconds()), scanKey)
}

func RevokeKey(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `UPDATE ingest_keys SET status = 'revoked', previous_hash = NULL WHERE id = $1 AND status <> 'revoked'`, id))
}

func UpdateKeyOrigins(ctx context.Context, tx pgx.Tx, id string, origins []string) (*model.APIKey, error) {
	return one(tx.QueryRow(ctx, `UPDATE ingest_keys SET allowed_origins = $2 WHERE id = $1 RETURNING `+keyColumns, id, mustJSON(origins)), scanKey)
}

// FirstIngestKeyMasked is onboarding's getting-started key.
func FirstIngestKeyMasked(ctx context.Context, tx pgx.Tx) (string, error) {
	var masked string
	err := tx.QueryRow(ctx, `SELECT key_masked FROM ingest_keys WHERE kind = 'ingestion_token' AND status <> 'revoked'
		ORDER BY created_at LIMIT 1`).Scan(&masked)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return masked, err
}

func scanRegistry(r pgx.Row) (*model.RegistryEvent, error) {
	var e model.RegistryEvent
	return &e, r.Scan(&e.ID, &e.Name, &e.Dims, &e.UniqueIneligible)
}

func ListRegistry(ctx context.Context, tx pgx.Tx) ([]model.RegistryEvent, error) {
	rows, err := tx.Query(ctx, `SELECT id, name, dims, unique_ineligible FROM event_registry ORDER BY name`)
	if err != nil {
		return nil, err
	}
	return collect(rows, scanRegistry)
}

func UpsertRegistry(ctx context.Context, tx pgx.Tx, orgID string, e model.RegistryEvent) (*model.RegistryEvent, error) {
	return one(tx.QueryRow(ctx, `INSERT INTO event_registry (org_id, name, dims, unique_ineligible) VALUES ($1, $2, $3, $4)
		ON CONFLICT (org_id, name) DO UPDATE SET dims = EXCLUDED.dims, unique_ineligible = EXCLUDED.unique_ineligible
		RETURNING id, name, dims, unique_ineligible`, orgID, e.Name, e.Dims, e.UniqueIneligible), scanRegistry)
}

func DeleteRegistry(ctx context.Context, tx pgx.Tx, id string) error {
	return affected(tx.Exec(ctx, `DELETE FROM event_registry WHERE id = $1`, id))
}
